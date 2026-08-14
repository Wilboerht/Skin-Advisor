import { NextRequest, NextResponse } from "next/server";
import { ADVISOR_WECOM_LINK } from "@/lib/advisor-report-text";

const SESSION_ID_RE = /^[0-9A-Za-z-]{8,128}$/;

/**
 * 生成带 scene_param 的护肤顾问客服链接（结果页「打开护肤顾问」按钮使用）。
 *
 * 官方要求：scene_param 必须拼接在「获取客服账号链接」接口返回的 url 之后，
 * 该接口由企业微信 AI 客服服务（wecom-ai-bot）持有企微密钥并代理生成。
 * 失败时回退到静态 kfid 链接（无场景参数，客服侧退化为手动复制粘贴流程）。
 */
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
    const fallback = NextResponse.json({ url: ADVISOR_WECOM_LINK, fallback: true });

    if (!SESSION_ID_RE.test(sessionId)) {
        return fallback;
    }

    const base = (process.env.WECOM_BOT_BASE_URL || "https://kf.nihplod.cn").replace(/\/+$/, "");
    const internalKey = process.env.INTERNAL_API_KEY;

    try {
        const resp = await fetch(
            `${base}/api/kf-link?session_id=${encodeURIComponent(sessionId)}`,
            {
                headers: internalKey ? { "x-internal-key": internalKey } : {},
                signal: AbortSignal.timeout(5000),
                cache: "no-store",
            }
        );
        if (!resp.ok) throw new Error(`kf-link upstream ${resp.status}`);
        const data = await resp.json();
        if (!data?.url) throw new Error("kf-link upstream empty url");
        return NextResponse.json({ url: data.url });
    } catch (error) {
        console.warn("[kf-link] fallback to static link:", error);
        return fallback;
    }
}
