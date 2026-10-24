/**
 * 管理端用户完整测肤报告（主站控制中台 ↔ 子站内部接口）
 *
 * - 列表只返回报告摘要，不带完整 analysisResult，避免列表接口过大
 * - 详情按 userId + sessionId 校验归属，返回结构化报告数据
 * - 不返回人脸图片、原始问卷 answers；问卷只返回标签化档案
 * - 已归档报告不提供完整详情；过期报告保留可查看并标记 expired
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    isCompletedAnalysisResult,
    normalizeAnalysisResult,
    type ComprehensiveResult,
} from "@/lib/analysis-result";
import { extractSessionLite } from "@/lib/session-lite";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import {
    sanitizeConsultantReport,
    type FaceAnalysisResult,
} from "@/lib/advisor-utils";
import { extractReportSummary, type ReportSummary } from "@/lib/internal-report";
import { getScoreDistribution } from "@/lib/score-percentile-db";
import { percentileFromDistribution } from "@/lib/score-percentile";
import { logger } from "@/lib/logger";

export interface AdminUserReportListItem {
    sessionId: string;
    createdAt: string;
    completedAt: string;
    overallScore: number | null;
    skinTypeLabel: string | null;
    persona: string | null;
    personaLabel: string | null;
    reportVersion: number | null;
    dataSource: string | null;
    expired: boolean;
}

export interface AdminUserReportDetail {
    sessionId: string;
    createdAt: string;
    completedAt: string;
    expiresAt: string | null;
    expired: boolean;
    personaLabel: string | null;
    summary: ReportSummary;
    result: ComprehensiveResult;
    faceAnalysis: FaceAnalysisResult | null;
}

export interface AdminUserReportListResult {
    reports: AdminUserReportListItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readReportVersion(raw: Record<string, unknown> | null): number | null {
    return typeof raw?.reportVersion === "number" ? raw.reportVersion : null;
}

function readDataSource(raw: Record<string, unknown> | null): string | null {
    return typeof raw?.dataSource === "string" ? raw.dataSource : null;
}

function personaLabel(persona: string | null): string | null {
    return persona ? getSkinTypeByIpKey(persona)?.typeName ?? null : null;
}

function isExpired(expiresAt: Date | null): boolean {
    return !!expiresAt && expiresAt.getTime() < Date.now();
}

export async function listAdminUserReports(
    userId: string,
    options: { page?: number; limit?: number } = {}
): Promise<AdminUserReportListResult> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const skip = (page - 1) * limit;

    const where = {
        userId,
        completedAt: { not: null },
        archivedAt: null,
        analysisResult: { not: Prisma.DbNull },
    } as const;

    const [sessions, total] = await Promise.all([
        prisma.advisorSession.findMany({
            where,
            orderBy: { completedAt: "desc" },
            skip,
            take: limit,
            select: {
                sessionId: true,
                createdAt: true,
                completedAt: true,
                expiresAt: true,
                analysisResult: true,
            },
        }),
        prisma.advisorSession.count({ where }),
    ]);

    return {
        reports: sessions.map((session) => {
            const raw = readRecord(session.analysisResult);
            const lite = extractSessionLite(session.analysisResult);
            return {
                sessionId: session.sessionId,
                createdAt: session.createdAt.toISOString(),
                completedAt: session.completedAt?.toISOString() ?? session.createdAt.toISOString(),
                overallScore: lite.score,
                skinTypeLabel: lite.typeLabel,
                persona: lite.persona,
                personaLabel: personaLabel(lite.persona),
                reportVersion: readReportVersion(raw),
                dataSource: readDataSource(raw),
                expired: isExpired(session.expiresAt),
            };
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getAdminUserReportDetail(
    userId: string,
    sessionId: string
): Promise<AdminUserReportDetail | null> {
    const session = await prisma.advisorSession.findFirst({
        where: {
            sessionId,
            userId,
            completedAt: { not: null },
            archivedAt: null,
        },
        select: {
            sessionId: true,
            createdAt: true,
            completedAt: true,
            expiresAt: true,
            analysisResult: true,
            answers: true,
        },
    });

    if (
        !session?.analysisResult ||
        !isCompletedAnalysisResult(session.analysisResult)
    ) {
        return null;
    }

    const result = normalizeAnalysisResult(session.analysisResult);
    if (!result) return null;

    const completedAt = session.completedAt?.toISOString() ?? session.createdAt.toISOString();
    result.expiresAt = session.expiresAt?.toISOString();
    result.analyzedAt = completedAt;
    if (result.consultantReport) {
        result.consultantReport = sanitizeConsultantReport(result.consultantReport);
    }

    const raw = readRecord(session.analysisResult);
    const faceAnalysis =
        raw?.faceAnalysis && typeof raw.faceAnalysis === "object"
            ? (raw.faceAnalysis as FaceAnalysisResult)
            : null;

    let percentile: number | null = null;
    try {
        if (typeof faceAnalysis?.overallScore === "number") {
            const distribution = await getScoreDistribution();
            percentile = percentileFromDistribution(
                distribution,
                Math.round(faceAnalysis.overallScore)
            );
        }
    } catch (error) {
        logger.warn("[admin-user-reports] percentile aggregate failed", {
            error: String(error),
        });
    }

    const summary = extractReportSummary(
        session.analysisResult,
        session.sessionId,
        session.answers,
        percentile
    );
    if (!summary.found) return null;

    return {
        sessionId: session.sessionId,
        createdAt: session.createdAt.toISOString(),
        completedAt,
        expiresAt: session.expiresAt?.toISOString() ?? null,
        expired: isExpired(session.expiresAt),
        personaLabel: personaLabel(result.persona ?? null),
        summary,
        result,
        faceAnalysis,
    };
}
