import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return NextResponse.json({ error: "参数不完整" }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "密码长度不足" }, { status: 400 });
        }

        // 验证 Token
        const payload = await verifyToken(token);
        if (!payload || payload.type !== "reset") {
            return NextResponse.json({ error: "重置链接已失效" }, { status: 400 });
        }

        const email = payload.email;
        if (!email) {
            return NextResponse.json({ error: "Token 无效" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ error: "用户不存在" }, { status: 404 });
        }

        // 更新密码
        const hashedPassword = await hashPassword(password);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        return NextResponse.json({ success: true, message: "密码已重置" });

    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
