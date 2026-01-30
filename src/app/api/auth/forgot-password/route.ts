import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "邮箱不能为空" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // 返回成功以防止邮箱枚举攻击
            return NextResponse.json({ success: true, message: "如果邮箱存在，重置链接已发送" });
        }

        // 生成重置 Token (1小时有效)
        const resetToken = await signToken({ sub: user.id, email: user.email, type: "reset" }, "1h");

        // 构造链接
        const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const resetLink = `${origin}/reset-password?token=${resetToken}`;

        // 模拟发送邮件
        console.log("=========================================");
        console.log(`[Email Service] Password Reset Request`);
        console.log(`To: ${email}`);
        console.log(`Link: ${resetLink}`);
        console.log("=========================================");

        return NextResponse.json({ success: true, message: "重置链接已发送" });

    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
