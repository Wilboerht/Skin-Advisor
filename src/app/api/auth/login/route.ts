
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { z } from "zod";

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = LoginSchema.parse(body);

        // Find User
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Verify Password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Sign Token
        const token = await signToken({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });

        // Response
        const response = NextResponse.json({
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
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
