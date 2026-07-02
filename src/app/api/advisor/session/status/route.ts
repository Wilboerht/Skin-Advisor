import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { normalizeAnalysisResult } from "@/app/(advisor)/result/ResultClient";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
    try {
        // 1. 速率限制
        const ip = getClientIP(request);
        const limit = await rateLimit(`session-status-${ip}`, "session-status", {
            maxRequests: 60,
            windowMs: 60 * 1000
        });

        const rateLimitHeaders = {
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
            "X-RateLimit-Reset": String(limit.reset)
        };

        if (!limit.success) {
            return NextResponse.json(
                { error: "请求过于频繁，请稍后再试" },
                { status: 429, headers: rateLimitHeaders }
            );
        }

        // 2. 解析 sessionId
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json(
                { error: "缺少 sessionId 参数" },
                { status: 400, headers: rateLimitHeaders }
            );
        }

        // 3. 查询 session
        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: {
                analysisStartedAt: true,
                completedAt: true,
                analysisResult: true,
                ip: true,
                userId: true
            }
        });

        if (!session) {
            return NextResponse.json(
                { status: "not_found", sessionId },
                { status: 404, headers: rateLimitHeaders }
            );
        }

        // 4. 状态判断
        const isCompleted = !!session.completedAt && !!session.analysisResult;
        const isStarted = !!session.analysisStartedAt;

        let status: "pending" | "analyzing" | "completed";
        if (isCompleted) {
            status = "completed";
        } else if (isStarted) {
            status = "analyzing";
        } else {
            status = "pending";
        }

        // 5. completed 时返回结果，但先做简单权限校验
        // sessionId 是 UUID，枚举成本高；这里仅防止明显的跨用户/跨 IP 读取
        if (status === "completed") {
            const currentUser = await getSession();
            const currentIpHash = hashIP(ip);

            if (session.userId) {
                // 登录用户：必须本人
                if (currentUser?.id !== session.userId) {
                    return NextResponse.json(
                        { status: "forbidden", sessionId },
                        { status: 403, headers: rateLimitHeaders }
                    );
                }
            } else {
                // 游客：放宽校验，仅在能确定 IP 不匹配时拒绝
                // 实际场景中 CDN/代理可能导致 IP 变化，因此只做宽松校验
                if (session.ip && session.ip !== currentIpHash) {
                    // 不直接拒绝，而是只返回状态，不返回结果
                    return NextResponse.json(
                        { status: "completed", sessionId, result: null },
                        { status: 200, headers: rateLimitHeaders }
                    );
                }
            }

            const rawResult = session.analysisResult as Record<string, unknown> | null;
            const normalized = rawResult ? normalizeAnalysisResult(rawResult) : null;

            return NextResponse.json(
                {
                    status,
                    sessionId,
                    result: normalized,
                    rawResult
                },
                { status: 200, headers: rateLimitHeaders }
            );
        }

        return NextResponse.json(
            { status, sessionId },
            { status: 200, headers: rateLimitHeaders }
        );
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("[SessionStatus] Failed to get session status:", err);
        return NextResponse.json(
            { error: "查询会话状态失败" },
            { status: 500 }
        );
    }
}
