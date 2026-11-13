import { NextRequest, NextResponse } from "next/server";
import { ADVISOR_WECOM_LINK } from "@/lib/advisor-report-text";
import { getSessionUser } from "@/lib/sso-auth";
import prisma from "@/lib/prisma";
import { getClientIP, rateLimit } from "@/lib/ratelimit";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

/**
 * 生成带 scene_param 的护肤顾问客服链接（结果页「打开护肤顾问」按钮使用）。
 *
 * 官方要求：scene_param 必须拼接在「获取客服账号链接」接口返回的 url 之后，
 * 该接口由企业微信 AI 客服服务（wecom-ai-bot）持有企微密钥并代理生成。
 * 失败时回退到静态 kfid 链接（无场景参数，客服侧退化为手动复制粘贴流程）。
 *
 * sessionId 是报告凭证：
 * - 推荐使用 POST JSON `{ "sessionId": "..." }` 或 `x-session-id` 请求头；
 * - GET query 仅为旧调用方兼容保留，调用方应尽快迁移；
 * - 服务端 → wecom-ai-bot 已改为 x-session-id 请求头。
 */
async function handle(request: NextRequest, sessionId: string) {
    const ipLimit = await rateLimit(`kf-link-ip-${getClientIP(request)}`, "default", {
        maxRequests: 30,
        windowMs: 60_000,
    });
    if (!ipLimit.success) {
        return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
    }
    const fallback = NextResponse.json({ url: ADVISOR_WECOM_LINK, fallback: true });

    if (!SESSION_ID_RE.test(sessionId)) {
        return fallback;
    }

    const user = await getSessionUser(request);
    if (!user) return fallback;
    try {
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId, userId: user.id },
            select: { sessionId: true },
        });
        if (!session) return fallback;
    } catch {
        return fallback;
    }

    const base = (process.env.WECOM_BOT_BASE_URL || "https://kf.nihplod.cn").replace(/\/+$/, "");
    const internalKey = process.env.INTERNAL_API_KEY;

    try {
        const resp = await fetch(`${base}/api/kf-link`, {
            headers: {
                ...(internalKey ? { "x-internal-key": internalKey } : {}),
                // sessionId 是报告凭证：走请求头，避免进入 Nginx/Cloudflare 访问日志
                "x-session-id": sessionId,
            },
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
        });
        if (!resp.ok) throw new Error(`kf-link upstream ${resp.status}`);
        const data = await resp.json();
        if (!data?.url) throw new Error("kf-link upstream empty url");
        return NextResponse.json({ url: data.url });
    } catch (error) {
        console.warn("[kf-link] fallback to static link:", error);
        return fallback;
    }
}

export async function GET(request: NextRequest) {
    // 兼容旧调用方；新调用方请使用 POST body 或 x-session-id 请求头
    return handle(request, request.nextUrl.searchParams.get("sessionId") || "");
}

export async function POST(request: NextRequest) {
    const headerSessionId = (request.headers.get("x-session-id") || "").trim();
    let bodySessionId = "";
    try {
        const body = await request.json();
        if (body && typeof body === "object" && "sessionId" in body) {
            bodySessionId = String((body as { sessionId?: unknown }).sessionId ?? "").trim();
        }
    } catch {
        // 空 body / 非 JSON：继续用请求头
    }
    return handle(request, headerSessionId || bodySessionId);
}
