import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSession, incrementTokenVersion } from "@/lib/auth";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    // 显式登出时递增 tokenVersion，使当前 token 及其它设备上的 token 立即失效
    try {
        const localUser = await getSession();
        if (localUser) {
            await incrementTokenVersion(localUser.id);
        }
    } catch {
        // ignore session lookup errors during logout
    }

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

        // 清除本地 auth_token（含新旧两种 cookie 名，确保平滑过渡）
        response.cookies.delete(AUTH_COOKIE_NAME);
        response.cookies.delete("auth_token");
        response.cookies.delete("user_token");
        response.cookies.delete(CSRF_COOKIE_NAME);

        return response;
    } catch (e) {
        console.error("Logout Proxy Error", e);
        const fallback = NextResponse.json({ success: true });
        fallback.cookies.delete(AUTH_COOKIE_NAME);
        fallback.cookies.delete("auth_token");
        fallback.cookies.delete("user_token");
        fallback.cookies.delete(CSRF_COOKIE_NAME);
        return fallback;
    }
}
