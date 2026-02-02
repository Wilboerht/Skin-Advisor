import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
        if (!user) {
            // 返回成功以防止手机号枚举攻击
            return NextResponse.json({ success: true, message: "验证码已发送" });
        }

        // 生成重置 Token (1小时有效) - 这里实际场景可能生成4-6位数字验证码存Redis
        // 为了简化，我们还是生成 Token URL 方式，或者简单的验证码逻辑
        const resetToken = await signToken({ sub: user.id, phone: user.phoneNumber, type: "reset" }, "1h");

        // 构造链接 (如果用户是通过短信点链接)
        const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const resetLink = `${origin}/reset-password?token=${resetToken}`;

        // 模拟生成验证码
        const mockCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 模拟发送短信
        console.log("=========================================");
        console.log(`[SMS Service] Password Reset Request`);
        console.log(`To: ${phone}`);
        console.log(`Verification Code: ${mockCode}`);
        console.log(`Reset Link (Dev): ${resetLink}`);
        console.log("=========================================");

        return NextResponse.json({ success: true, message: "验证码已发送" });

    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
