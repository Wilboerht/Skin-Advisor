/**
 * 测肤记录查询（公共路由 /api/advisor/history 与内部接口共用）
 *
 * - page：页码（offset 分页）
 * - before：游标分页（只取该完成时间之前的记录）
 * - lite：只返回 score + 肤质标签 + 派系；优先读 SkinAssessment，缺失时回退完整 JSON
 * - view：返回跨端 ReportView 摘要
 */
import prisma from "@/lib/prisma";
import { extractSessionLite } from "@/lib/session-lite";
import { normalizeAnalysisResult } from "@/lib/analysis-result";
import type { FaceAnalysisResult } from "@/lib/advisor-utils";
import { buildReportSummaryCard } from "@/lib/report/view";
import { REPORT_VIEW_VERSION } from "@/lib/report/types";

export interface TestHistoryQuery {
    page: number;
    limit: number;
    lite: boolean;
    /** 返回跨端 ReportView 摘要（小程序历史/档案用）；优先级高于 lite */
    view?: boolean;
    before: Date | null;
}

export interface TestHistoryPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export async function getTestHistory(
    userId: string,
    query: TestHistoryQuery
): Promise<{ history: unknown[]; pagination: TestHistoryPagination }> {
    const { page, limit, lite, view: viewMode, before } = query;
    const skip = (page - 1) * limit;
    const beforeValid = before && !Number.isNaN(before.getTime()) ? before : null;

    const sessionWhere = {
        userId,
        completedAt: beforeValid ? { lt: beforeValid } : { not: null },
        archivedAt: null,
    };

    const total = await prisma.advisorSession.count({
        where: {
            userId,
            completedAt: { not: null },
            archivedAt: null,
        },
    });
    const pagination: TestHistoryPagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };

    // view=1：历史列表/档案只需要摘要卡，优先读 SkinAssessment，避免逐行解析完整报告
    if (viewMode) {
        const rows = await prisma.advisorSession.findMany({
            where: sessionWhere,
            orderBy: { completedAt: "desc" },
            select: {
                sessionId: true,
                completedAt: true,
                skinAssessment: {
                    select: {
                        overallScore: true,
                        skinTypeLabel: true,
                        skinAge: true,
                        persona: true,
                        reportVersion: true,
                        findings: true,
                    },
                },
            },
            skip: beforeValid ? 0 : skip,
            take: limit,
        });
        const missingIds = rows.filter((row) => !row.skinAssessment).map((row) => row.sessionId);
        const fallbackRows = missingIds.length > 0
            ? await prisma.advisorSession.findMany({
                where: { sessionId: { in: missingIds } },
                select: { sessionId: true, analysisResult: true },
            })
            : [];
        const fallbackById = new Map(fallbackRows.map((row) => [row.sessionId, row.analysisResult]));

        return {
            history: rows.map((row) => {
                const assessment = row.skinAssessment;
                if (assessment) {
                    const findings = Array.isArray(assessment.findings)
                        ? assessment.findings as Array<Record<string, unknown>>
                        : [];
                    const first = findings[0];
                    const rawSeverity = first?.severity;
                    const severity = rawSeverity === "moderate" || rawSeverity === "severe" ? rawSeverity : "mild";
                    return {
                        sessionId: row.sessionId,
                        completedAt: row.completedAt,
                        view: {
                            sessionId: row.sessionId,
                            completedAt: row.completedAt?.toISOString(),
                            overallScore: assessment.overallScore ?? undefined,
                            skinTypeLabel: assessment.skinTypeLabel ?? undefined,
                            skinAge: assessment.skinAge ?? undefined,
                            persona: assessment.persona ?? undefined,
                            reportVersion: assessment.reportVersion ?? 3,
                            viewVersion: REPORT_VIEW_VERSION,
                            ...(typeof first?.title === "string" ? {
                                topFinding: {
                                    title: first.title,
                                    severity,
                                    severityLabel: severity === "moderate" ? "中度" : severity === "severe" ? "重度" : "轻度",
                                },
                            } : {}),
                        },
                    };
                }

                const raw = (fallbackById.get(row.sessionId) || {}) as Record<string, unknown>;
                const result = normalizeAnalysisResult(raw);
                if (!result) {
                    return { sessionId: row.sessionId, completedAt: row.completedAt, view: null };
                }
                const faceAnalysis = (raw.faceAnalysis as FaceAnalysisResult | null) || null;
                return {
                    sessionId: row.sessionId,
                    completedAt: row.completedAt,
                    view: buildReportSummaryCard({
                        result,
                        faceAnalysis,
                        sessionId: row.sessionId,
                        completedAt: row.completedAt?.toISOString(),
                    }),
                };
            }),
            pagination,
        };
    }

    // lite：只读汇总表，避免为时间线/列表解析完整 analysisResult。
    // 回填缺失时仅对当前页补读完整 JSON。
    if (lite && !viewMode) {
        const rows = await prisma.advisorSession.findMany({
            where: sessionWhere,
            orderBy: { completedAt: "desc" },
            select: {
                sessionId: true,
                completedAt: true,
                skinAssessment: {
                    select: { overallScore: true, skinTypeLabel: true, persona: true },
                },
            },
            skip: beforeValid ? 0 : skip,
            take: limit,
        });

        const missingIds = rows.filter((row) => !row.skinAssessment).map((row) => row.sessionId);
        const fallbackRows = missingIds.length > 0
            ? await prisma.advisorSession.findMany({
                where: { sessionId: { in: missingIds } },
                select: { sessionId: true, analysisResult: true },
            })
            : [];
        const fallbackById = new Map(fallbackRows.map((row) => [row.sessionId, row.analysisResult]));

        return {
            history: rows.map((row) => {
                const liteData = row.skinAssessment
                    ? {
                        score: row.skinAssessment.overallScore,
                        typeLabel: row.skinAssessment.skinTypeLabel,
                        persona: row.skinAssessment.persona,
                    }
                    : extractSessionLite(fallbackById.get(row.sessionId));
                return {
                    sessionId: row.sessionId,
                    completedAt: row.completedAt,
                    analysisResult: {
                        ...(liteData.score != null ? { faceAnalysis: { overallScore: liteData.score } } : {}),
                        ...(liteData.typeLabel ? { skinProfile: { typeLabel: liteData.typeLabel } } : {}),
                        ...(liteData.persona ? { persona: liteData.persona } : {}),
                    },
                };
            }),
            pagination,
        };
    }

    const history = await prisma.advisorSession.findMany({
        where: sessionWhere,
        orderBy: { completedAt: "desc" },
        select: {
            sessionId: true,
            completedAt: true,
            analysisResult: true,
        },
        skip: beforeValid ? 0 : skip,
        take: limit,
    });

    const payload = viewMode
        ? history.map((session) => {
            const raw = (session.analysisResult || {}) as Record<string, unknown>;
            const result = normalizeAnalysisResult(raw);
            if (!result) {
                return { sessionId: session.sessionId, completedAt: session.completedAt, view: null };
            }
            const faceAnalysis = (raw.faceAnalysis as FaceAnalysisResult | null) || null;
            const summary = buildReportSummaryCard({
                result,
                faceAnalysis,
                sessionId: session.sessionId,
                completedAt: session.completedAt?.toISOString(),
            });
            return {
                sessionId: session.sessionId,
                completedAt: session.completedAt,
                view: summary,
            };
        })
        : history;

    return { history: payload, pagination };
}
