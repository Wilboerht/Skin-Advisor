import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
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

        const response = NextResponse.json({ success: true, ...responseData });

        // 透传官网所有 Set-Cookie 头（可能包含多条 cookie 清除指令）
        mirrorOfficialCookies(officialResponse, response, "logout");

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
