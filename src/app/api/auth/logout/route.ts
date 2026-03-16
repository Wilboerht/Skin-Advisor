import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    try {
        const officialApiUrl = process.env.OFFICIAL_API_URL || "https://nihplod.cn";
        const officialResponse = await fetch(`${officialApiUrl}/api/auth/logout`, {
            method: "POST",
            headers: {
                "Cookie": allCookies
            }
        });

        const responseData = await officialResponse.json();
        const setCookieHeader = officialResponse.headers.get("Set-Cookie");

        const response = NextResponse.json({ success: true, ...responseData });

        // 透传删除 Cookie 的指令
        if (setCookieHeader) {
            response.headers.set("Set-Cookie", setCookieHeader);
        }

        // 为了平滑过渡，我们也顺手清除遗留的 auth_token / user_token
        response.cookies.delete("auth_token");
        response.cookies.delete("user_token");

        return response;
    } catch (e) {
        console.error("Logout Proxy Error", e);
        const fallback = NextResponse.json({ success: true });
        fallback.cookies.delete("auth_token");
        fallback.cookies.delete("user_token");
        return fallback;
    }
}
