import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { logger } from "@/lib/logger";

// 防重放：5 分钟时间窗 + nonce 去重
const WEBHOOK_TIME_WINDOW_MS = 5 * 60 * 1000;
const seenNonces = new Set<string>();
const MAX_NONCES = 10000;

/** 仅检查时间窗，不产生副作用 */
function isTimeInvalid(timestamp: string): boolean {
    const ts = parseInt(timestamp, 10) * 1000;
    if (Number.isNaN(ts)) return true;
    return Math.abs(Date.now() - ts) > WEBHOOK_TIME_WINDOW_MS;
}

/** 仅检查 nonce 是否已见，不记录 */
function isNonceSeen(nonce: string): boolean {
    return seenNonces.has(nonce);
}

/** 验签通过后才记录 nonce。
 * 原实现在校验前就写入 seenNonces，攻击者可用任意伪造 nonce 灌满去重集合，
 * 使合法 nonce 被提前淘汰，从而绕过防重放。 */
function recordNonce(nonce: string): void {
    seenNonces.add(nonce);
    if (seenNonces.size > MAX_NONCES) {
        const first = seenNonces.values().next().value as string | undefined;
        if (first) seenNonces.delete(first);
    }
}

/** 常量时间比较，避免时序侧信道泄露 signature 前缀信息 */
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
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

    // 防重放检查（只读：时间窗 + nonce 是否已见，不写入）
    if (isTimeInvalid(timestamp) || isNonceSeen(nonce)) {
        return new NextResponse("Invalid timestamp or replayed nonce", { status: 403 });
    }

    // 微信官方的验证规则：
    // 1. 将token、timestamp、nonce三个参数进行字典序排序
    const arr = [token, timestamp, nonce].sort();

    // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
    const str = arr.join("");
    const sha1 = crypto.createHash("sha1").update(str).digest("hex");

    // 3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
    if (safeEqual(sha1, signature)) {
        // 验签通过后才记录 nonce，防止伪造请求灌满去重集合
        recordNonce(nonce);
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

    // 防重放检查（只读：时间窗 + nonce 是否已见，不写入）
    if (isTimeInvalid(timestamp) || isNonceSeen(nonce)) {
        return new NextResponse("Invalid timestamp or replayed nonce", { status: 403 });
    }

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join("");
    const sha1 = crypto.createHash("sha1").update(str).digest("hex");

    if (!safeEqual(sha1, signature)) {
        logger.error("微信 Webhook POST 验证失败: signature 不匹配");
        return new NextResponse("Invalid signature", { status: 403 });
    }

    // 验签通过后才记录 nonce
    recordNonce(nonce);

    // Signature verified. For now, return success as per WeChat spec.
    return new NextResponse("success");
}
