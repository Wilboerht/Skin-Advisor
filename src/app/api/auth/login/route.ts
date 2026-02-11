
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { z } from "zod";

const LoginSchema = z.object({
    phone: z.string().min(1),
    password: z.string().min(1)
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, password } = LoginSchema.parse(body);

        // Find User by Phone
        const user = await prisma.user.findUnique({
            where: { phoneNumber: phone }
        });

        if (!user) {
            return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
        }

        // Verify Password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
        }

        // Sign Token
        const token = await signToken({
            sub: user.id,
            phone: user.phoneNumber,
            name: user.name,
            role: user.role,
            vipExpiresAt: user.vipExpiresAt
        });

        // Response
        const response = NextResponse.json({
            user: {
                id: user.id,
                phone: user.phoneNumber,
                name: user.name,
                role: user.role,
                vipExpiresAt: user.vipExpiresAt
            }
        });

        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/"
        });

        return response;

    } catch (e) {
        return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }
}
