import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { normalizeAnalysisResult } from "@/lib/analysis-result";

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

        // 5. 所有权校验：对所有状态统一检查，防止 session 枚举攻击
        const currentUser = await getSession();
        const currentIpHash = hashIP(ip);
        let forbidden = false;

        if (session.userId) {
            // 登录用户会话：必须本人
            if (currentUser?.id !== session.userId) {
                forbidden = true;
            }
        } else {
            // 游客会话：IP 哈希必须匹配
            if (session.ip && session.ip !== currentIpHash) {
                forbidden = true;
            }
        }

        if (forbidden) {
            // 返回 not_found 而非 forbidden，避免泄露 session 存在性
            return NextResponse.json(
                { status: "not_found", sessionId },
                { status: 404, headers: rateLimitHeaders }
            );
        }

        // 6. completed 时返回结果
        if (status === "completed") {
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
