import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
        console.error("WECHAT_TOKEN is not configured");
        return new NextResponse("Server Configuration Error", { status: 500 });
    }

    // 参数校验
    if (!signature || !timestamp || !nonce) {
        return new NextResponse("Invalid Request", { status: 400 });
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
        console.error("微信服务器验证失败: signature 不匹配");
        return new NextResponse("Invalid signature", { status: 403 });
    }
}

// 接收用户在公众号发的文本消息和事件
export async function POST(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const signature = searchParams.get("signature");
    const timestamp = searchParams.get("timestamp");
    const nonce = searchParams.get("nonce");

    const token = process.env.WECHAT_TOKEN || "skinadvisor2026";

    if (!signature || !timestamp || !nonce) {
        return new NextResponse("Invalid Request", { status: 400 });
    }

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join("");
    const sha1 = crypto.createHash("sha1").update(str).digest("hex");

    if (sha1 !== signature) {
        console.error("微信 Webhook POST 验证失败: signature 不匹配");
        return new NextResponse("Invalid signature", { status: 403 });
    }

    // Signature verified. For now, return success as per WeChat spec.
    return new NextResponse("success");
}
