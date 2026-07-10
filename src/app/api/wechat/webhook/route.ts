import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { logger } from "@/lib/logger";

// 防重放：5 分钟时间窗 + nonce 去重
const WEBHOOK_TIME_WINDOW_MS = 5 * 60 * 1000;
const seenNonces = new Set<string>();
const MAX_NONCES = 10000;

function isReplay(timestamp: string, nonce: string): boolean {
    const ts = parseInt(timestamp, 10) * 1000;
    if (Number.isNaN(ts)) return true;
    if (Math.abs(Date.now() - ts) > WEBHOOK_TIME_WINDOW_MS) return true;
    if (seenNonces.has(nonce)) return true;
    seenNonces.add(nonce);
    if (seenNonces.size > MAX_NONCES) {
        const first = seenNonces.values().next().value as string | undefined;
        if (first) seenNonces.delete(first);
    }
    return false;
}

export async function GET(request: NextRequest) {
    // 从请求 URL 的查询参数中获取微信传入的验证参数
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get("signature");
    const timestamp = searchParams.get("timestamp");
    const nonce = searchParams.get("nonce");
    const echostr = searchParams.get("echostr");

    // 这个 TOKEN 必须和微信公众平台后台配置的一致
    const token = process.env.WECHAT_TOKEN;
    if (!token) {
        logger.error("WECHAT_TOKEN is not configured");
        return new NextResponse("Server Configuration Error", { status: 500 });
    }

    // 参数校验
    if (!signature || !timestamp || !nonce) {
        return new NextResponse("Invalid Request", { status: 400 });
    }

    // 防重放检查
    if (isReplay(timestamp, nonce)) {
        return new NextResponse("Invalid timestamp or replayed nonce", { status: 403 });
    }

    // 微信官方的验证规则：
    // 1. 将token、timestamp、nonce三个参数进行字典序排序
    const arr = [token, timestamp, nonce].sort();

    // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
    const str = arr.join("");
    const sha1 = crypto.createHash("sha1").update(str).digest("hex");

    // 3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
    if (sha1 === signature) {
        // 验证成功，必须原样返回 echostr
        if (echostr) {
            return new NextResponse(echostr);
        }
        return new NextResponse("success");
    } else {
        // 验证失败
        logger.error("微信服务器验证失败: signature 不匹配");
        return new NextResponse("Invalid signature", { status: 403 });
    }
}

// 接收用户在公众号发的文本消息和事件
export async function POST(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get("signature");
    const timestamp = searchParams.get("timestamp");
    const nonce = searchParams.get("nonce");

    const token = process.env.WECHAT_TOKEN;
    if (!token) {
        logger.error("WECHAT_TOKEN is not configured");
        return new NextResponse("Server Configuration Error", { status: 500 });
    }

    if (!signature || !timestamp || !nonce) {
        return new NextResponse("Invalid Request", { status: 400 });
    }

    // 防重放检查
    if (isReplay(timestamp, nonce)) {
        return new NextResponse("Invalid timestamp or replayed nonce", { status: 403 });
    }

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join("");
    const sha1 = crypto.createHash("sha1").update(str).digest("hex");

    if (sha1 !== signature) {
        logger.error("微信 Webhook POST 验证失败: signature 不匹配");
        return new NextResponse("Invalid signature", { status: 403 });
    }

    // Signature verified. For now, return success as per WeChat spec.
    return new NextResponse("success");
}
