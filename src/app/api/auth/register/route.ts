
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { z } from "zod";

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2).optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, name } = RegisterSchema.parse(body);

        // Check if user exists
        const existing = await prisma.user.findUnique({
            where: { email }
        });

        if (existing) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        // Create User
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || email.split('@')[0]
            }
        });

        // Sign Token
        const token = await signToken({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        });

        // Return response with cookie
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

    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: e.issues }, { status: 400 });
        }
        console.error("Register Error", e);
        return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }
}
