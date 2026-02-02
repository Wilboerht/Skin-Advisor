
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { z } from "zod";

const RegisterSchema = z.object({
    phone: z.string().min(11, "手机号格式不正确"),
    password: z.string().min(6, "密码至少6位"),
    name: z.string().min(2).optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { phone, password, name } = RegisterSchema.parse(body);

        // Check if user exists
        const existing = await prisma.user.findUnique({
            where: { phoneNumber: phone }
        });

        if (existing) {
            return NextResponse.json({ error: "用户已存在" }, { status: 400 });
        }

        // Create User
        // Note: email is optional now, we leave it null for phone registration
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                phoneNumber: phone,
                password: hashedPassword,
                name: name || `User_${phone.slice(-4)}`,
                role: "user"
            }
        });

        // Sign Token
        const token = await signToken({
            sub: user.id,
            phone: user.phoneNumber,
            name: user.name,
            role: user.role
        });

        // Return response with cookie
        const response = NextResponse.json({
            user: { id: user.id, phone: user.phoneNumber, name: user.name, role: user.role }
        });

        response.cookies.set("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/"
        });

        return response;

    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: e.issues }, { status: 400 });
        }
        console.error("Register Error", e);
        return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }
}
