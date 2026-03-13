import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    // 官网下发的是 user_token 或者 auth_token，但统一通过 cookie 转发
    // 我们获取当前所有的 cookie
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return NextResponse.json({ user: null });
    }

    try {
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        
        // Add a timeout to prevent long hangs if the official API is unreachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased to 8 second timeout

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/me`, {
            method: "GET",
            headers: {
                "Cookie": allCookies
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = officialResponse.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            console.error("Official API returned non-JSON response", await officialResponse.text());
            return NextResponse.json({ user: null });
        }

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            return NextResponse.json({ user: null });
        }

        const userPayload = data.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        // Upsert user into local database so foreign keys (like History) don't break
        await prisma.user.upsert({
            where: { id: userPayload.id },
            update: {
                phoneNumber: userPayload.phone,
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
            },
            create: {
                id: userPayload.id,
                phoneNumber: userPayload.phone,
                password: "", // Local password isn't used
                name: userPayload.nickname || userPayload.phone,
                avatarUrl: userPayload.avatar || null,
                role: "user"
            }
        });

        return NextResponse.json({
            user: {
                ...data.data.user,
                phone: data.data.user.phone,
                name: data.data.user.nickname || data.data.user.phone,
                role: "user"
            }
        });

    } catch (e) {
        console.error("Me GET Proxy Error", e);
        return NextResponse.json({ user: null });
    }
}

export async function PUT(req: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    if (!allCookies) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // 我们代理到官网的 PUT /api/auth/me 去修改资料
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Cookie": allCookies
            },
            body: JSON.stringify(body)
        });

        const data = await officialResponse.json();

        if (!officialResponse.ok || !data.success) {
            return NextResponse.json({ error: data.error?.message || "更新失败" }, { status: officialResponse.status || 400 });
        }

        return NextResponse.json({
            success: true,
            user: {
                ...data.data.user,
                phone: data.data.user.phone,
                name: data.data.user.nickname || data.data.user.phone,
                role: "user"
            }
        });
    } catch (e) {
        console.error("Me PUT Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
