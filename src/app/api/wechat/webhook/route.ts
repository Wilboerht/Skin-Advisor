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
    const token = process.env.WECHAT_TOKEN || "skinadvisor2026";

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

// 预留接口：将来用于接收用户在公众号发的文本消息和事件
export async function POST(request: NextRequest) {
    // 根据微信规范，即使目前不处理 POST 消息，也必须返回 "success"
    return new NextResponse("success");
}
