/**
 * 同源请求校验（用于 CSRF 豁免的认证端点）。
 *
 * 登录/绑定/发短信等端点在 proxy 层被 CSRF 豁免，必须自己校验
 * Origin/Referer，否则攻击者可跨站触发短信或把受害者登录成攻击者账号。
 */
import type { NextRequest } from "next/server";
import { getPublicOrigin } from "@/lib/sso-config";

function originOf(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

export function isSameOriginRequest(req: NextRequest): boolean {
    const candidate = originOf(req.headers.get("origin")) ?? originOf(req.headers.get("referer"));

    if (!candidate) {
        // 隐私模式/旧浏览器可能不发送 Origin/Referer；
        // 现代浏览器的 Sec-Fetch-Site 由浏览器注入，跨站 JS 无法伪造。
        return req.headers.get("sec-fetch-site") === "same-origin";
    }

    const allowed = new Set<string>();
    const publicOrigin = getPublicOrigin();
    if (publicOrigin) allowed.add(publicOrigin);
    for (const env of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_BASE_URL]) {
        const origin = originOf(env);
        if (origin) allowed.add(origin);
    }
    // 兜底：请求自身的 origin（本地开发/未配置公网 URL 时）
    const requestOrigin = originOf(req.url);
    if (requestOrigin) allowed.add(requestOrigin);

    return allowed.has(candidate);
}
