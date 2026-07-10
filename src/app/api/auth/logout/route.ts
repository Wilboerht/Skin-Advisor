import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession, incrementTokenVersion, clearLocalSession } from "@/lib/auth";
import { mirrorOfficialCookies } from "@/lib/cookie-mirror";
import { callOfficialApi, type OfficialApiResponse } from "@/lib/official-api";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    // 显式登出时递增 tokenVersion + 撤销所有 refresh token
    try {
        const localUser = await getSession();
        if (localUser) {
            await incrementTokenVersion(localUser.id);
            await prisma.refreshToken.updateMany({
                where: { userId: localUser.id, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
    } catch {
        // ignore session lookup errors during logout
    }

    let body: { allDevices?: boolean } = {};
    try {
        body = await req.json();
    } catch {
        body = {};
    }

    try {
        const result = await callOfficialApi<OfficialApiResponse<{ message: string }>>({
            method: "POST",
            path: "/api/auth/logout",
            body,
            cookies: allCookies,
            requireSignature: false,
            timeoutMs: 30000,
        });

        if (result) {
            const responseData = result.data;
            const response = NextResponse.json({ ...responseData });

            // 透传官网所有 Set-Cookie 头（可能包含多条 cookie 清除指令）
            mirrorOfficialCookies(result.officialResponse, response, "logout");

            // 清除本地 session（含新旧兼容 cookie 名）
            clearLocalSession(response);

            return response;
        }
    } catch (e) {
        logger.error("Logout Proxy Error", e);
    }

    // 上游不可达或失败时的兜底：至少清理本地状态与官网 Cookie
    const fallback = NextResponse.json({ success: true });
    clearLocalSession(fallback);
    fallback.cookies.delete("__Host-user_token");
    fallback.cookies.delete("__Host-user_refresh_token");
    return fallback;
}
