import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function mirrorOfficialSessionCookie(officialResponse: Response, response: NextResponse) {
    const setCookieHeader = officialResponse.headers.get("set-cookie");
    
    if (!setCookieHeader) {
        console.warn("⚠️  Official API did NOT return set-cookie header in register response");
        return;
    }

    console.log(`📝 Official API returned cookie in register: ${setCookieHeader.substring(0, 50)}...`);

    // Handle potentially multiple Set-Cookie headers (can be comma-separated or multiple)
    const cookies = setCookieHeader.split(",").map(c => c.trim());
    
    for (const cookieStr of cookies) {
        // Split by first '=' to get name and value+attributes
        const eqIdx = cookieStr.indexOf("=");
        if (eqIdx === -1) continue;
        
        const cookieName = cookieStr.substring(0, eqIdx).trim();
        const rest = cookieStr.substring(eqIdx + 1);
        
        // Get value (before first semicolon)
        const semiIdx = rest.indexOf(";");
        const cookieValue = (semiIdx === -1 ? rest : rest.substring(0, semiIdx)).trim();
        
        if (!cookieName || !cookieValue) {
            console.warn(`⚠️  Skipped invalid cookie pair: ${cookieName}=${cookieValue}`);
            continue;
        }

        console.log(`✅ Setting cookie on register response: ${cookieName}`);
        response.cookies.set(cookieName, cookieValue, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });
    }
}

async function parseOfficialJson(officialResponse: Response) {
    const contentType = officialResponse.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const text = await officialResponse.text();
        console.error("Official API returned non-JSON response", text.slice(0, 300));
        return null;
    }
    try {
        return await officialResponse.json();
    } catch (err) {
        const text = await officialResponse.text();
        console.error("Official API JSON parse failed", text.slice(0, 300));
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        if (!body.phone || !body.code || !body.password) {
            return NextResponse.json({ error: "缺少必填项" }, { status: 400 });
        }

        // 官网注册接口需要: phone, code, password, confirmPassword
        // 我们在这个 proxy 里包装一层
        const registerPayload = {
            ...body,
            // 后端帮它补齐两次密码验证
            confirmPassword: body.password || "",
        };

        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        
        // 增加超时间：防止官方服务器（demo子域）响应过慢导致注册挂起
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const officialResponse = await fetch(`${officialApiUrl}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(registerPayload),
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));

        const responseData = await parseOfficialJson(officialResponse);

        if (!responseData) {
            return NextResponse.json(
                { error: "注册失败：上游服务响应异常" },
                { status: 502 }
            );
        }

        // 无论何种错误，透传给前端
        if (!officialResponse.ok || !responseData.success) {
            return NextResponse.json(
                { error: responseData.error?.message || "注册失败" },
                { status: officialResponse.status || 400 }
            );
        }

        // 获取并透传官网的 Cookie (含 Domain信息)
        const userPayload = responseData.data.user;

        // Prevent unique constraint collision if the phone exists on a different ID locally
        const existingByPhone = await prisma.user.findUnique({ where: { phoneNumber: userPayload.phone } });
        if (existingByPhone && existingByPhone.id !== userPayload.id) {
            await prisma.user.update({
                where: { id: existingByPhone.id },
                data: { phoneNumber: `merged_${existingByPhone.id}_${userPayload.phone}` }
            });
        }

        // Upsert user into local database
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

        const response = NextResponse.json({
            user: {
                ...responseData.data.user,
                phone: responseData.data.user.phone,
                name: responseData.data.user.nickname || responseData.data.user.phone,
                role: "user"
            }
        });

        mirrorOfficialSessionCookie(officialResponse, response);

        return response;

    } catch (e) {
        console.error("Register Proxy Error", e);
        return NextResponse.json({ error: "应用系统异常，请稍后重试" }, { status: 500 });
    }
}
