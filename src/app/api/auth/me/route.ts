import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ user: null });
    }



    const payload = await verifyToken(token);
    if (!payload?.sub) {
        return NextResponse.json({ user: null });
    }

    // Verify user actually exists in DB (fix for Zombie Tokens after DB reset)
    const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub as string }
    });

    if (!dbUser || dbUser.role === 'disabled') {
        // User not in DB or Disabled by Admin -> Invalid
        const response = NextResponse.json({ user: null });
        response.cookies.delete("auth_token");
        return response;
    }

    const user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role
    };

    const response = NextResponse.json({ user });

    // Logical Rolling Session:
    // If token expires in less than 2 days, issue a new one
    // payload.exp is in seconds
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp as number;
    const twoDays = 2 * 24 * 60 * 60;

    if (exp && (exp - now) < twoDays) {
        // Issue new token
        const newToken = await signToken({
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        }, '7d');

        response.cookies.set("auth_token", newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/"
        });

        // Console log for debug (optional)
        // console.log(`[Auth] Token refreshed for ${user.email}`);
    }

    return response;
}
