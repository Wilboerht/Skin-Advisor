/**
 * AI 顾问行为追踪 API
 * POST /api/advisor/analytics/track
 * 
 * 记录用户在顾问流程中的各种行为事件
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSessionUser } from "@/lib/sso-auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { hashIP } from "@/lib/privacy";
import { logger } from "@/lib/logger";

// 事件类型定义
const EventSchema = z.object({
    sessionId: z.string().min(1, "会话ID必填"),
    event: z.enum([
        "session_start",           // 会话开始（进入欢迎页）
        "questionnaire_start",     // 开始答题
        "questionnaire_complete",  // 完成问卷
        "face_scan_start",         // 开始面部扫描
        "face_scan_complete",      // 完成面部扫描
        "face_scan_skip",          // 跳过面部扫描
        "analysis_start",          // 开始分析
        "analysis_complete",       // 分析完成
        "result_view",             // 查看结果
        "result_share",            // 分享结果
        "product_click",           // 点击产品
    ]),
    data: z.record(z.string(), z.unknown()).optional(), // 附加数据
    timestamp: z.string().optional(),
});

type _TrackEvent = z.infer<typeof EventSchema>;

// 获取客户端信息
function getClientInfo(request: NextRequest) {
    const userAgent = request.headers.get("user-agent") || "";
    // 统一使用 getClientIP 获取原始 IP（限流和存储使用同一来源），再脱敏存储
    const rawIP = getClientIP(request);
    const referer = request.headers.get("referer") || "";

    // 哈希处理 IP 地址用于存储（不可逆，隐私合规）
    const ip = hashIP(rawIP);

    // 解析设备类型
    let deviceType = "desktop";
    if (/mobile/i.test(userAgent)) {
        deviceType = "mobile";
    } else if (/tablet|ipad/i.test(userAgent)) {
        deviceType = "tablet";
    }

    // 解析浏览器
    let browser = "unknown";
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
        browser = "chrome";
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
        browser = "safari";
    } else if (/firefox/i.test(userAgent)) {
        browser = "firefox";
    } else if (/edge/i.test(userAgent)) {
        browser = "edge";
    } else if (/msie|trident/i.test(userAgent)) {
        browser = "ie";
    }

    // 解析操作系统
    let os = "unknown";
    if (/windows/i.test(userAgent)) {
        os = "windows";
    } else if (/macintosh|mac os/i.test(userAgent)) {
        os = "macos";
    } else if (/linux/i.test(userAgent)) {
        os = "linux";
    } else if (/android/i.test(userAgent)) {
        os = "android";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        os = "ios";
    }

    return { userAgent, ip, referer, deviceType, browser, os };
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIP(request);
        const limitResult = await rateLimit(`analytics-${ip}`, "default", { maxRequests: 60, windowMs: 60 * 1000 });
        if (!limitResult.success) {
            return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
        }

        const body = await request.json();
        const result = EventSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: { message: "参数错误", details: result.error.issues } },
                { status: 400 }
            );
        }

        // 只有已登录用户才保存追踪数据到数据库
        const user = await getSessionUser(request);
        if (!user) {
            // 未登录用户直接返回成功，但不保存数据
            return NextResponse.json({ success: true });
        }

        const { sessionId, event, data } = result.data;
        const clientInfo = getClientInfo(request);
        const now = new Date();

        // 根据事件类型更新会话记录
        switch (event) {
            case "session_start": {
                // 创建或更新会话，登录用户的 session 写入 userId
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        startedAt: now,
                        userId: user.id,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                        fingerprint: (data?.fingerprint as string) || null,
                        utmSource: (data?.utm_source as string) || null,
                        utmMedium: (data?.utm_medium as string) || null,
                        utmCampaign: (data?.utm_campaign as string) || null,
                        refSource: (data?.ref_source as string) || null,
                    },
                    update: {
                        // 会话已存在时关联当前登录用户（session_start 仅对已登录用户触发，安全写入）
                        userId: user.id,
                    },
                });
                break;
            }

            case "questionnaire_start": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        questionnaireStartedAt: now,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: { questionnaireStartedAt: now },
                });
                break;
            }

            case "questionnaire_complete": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        questionnaireCompletedAt: now,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: {
                        questionnaireCompletedAt: now,
                    },
                });
                break;
            }

            case "face_scan_start": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        faceScanStartedAt: now,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: { faceScanStartedAt: now },
                });
                break;
            }

            case "face_scan_complete": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        faceScanCompletedAt: now,
                        faceScanUsed: true,
                        faceScanSkipped: false,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: {
                        faceScanCompletedAt: now,
                        faceScanUsed: true,
                        faceScanSkipped: false,
                    },
                });
                break;
            }

            case "face_scan_skip": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        faceScanSkipped: true,
                        faceScanUsed: false,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: {
                        faceScanSkipped: true,
                        faceScanUsed: false,
                    },
                });
                break;
            }

            case "analysis_start": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        analysisStartedAt: now,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: { analysisStartedAt: now },
                });
                break;
            }

            case "analysis_complete": {
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    create: {
                        sessionId,
                        analysisCompletedAt: now,
                        analysisSource: (data?.source as string) || null,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                    update: {
                        analysisCompletedAt: now,
                        analysisSource: (data?.source as string) || null,
                    },
                });
                break;
            }

            case "result_view": {
                // result_view 不应设置 completedAt：查看报告≠完成分析。
                // 只有真正完成分析流程才标记 completedAt（由 analyze API 设置）。
                await prisma.advisorSession.upsert({
                    where: { sessionId },
                    update: {
                        resultViewedAt: now,
                    },
                    create: {
                        sessionId,
                        startedAt: now,
                        resultViewedAt: now,
                        userAgent: clientInfo.userAgent,
                        ip: clientInfo.ip,
                        referrer: clientInfo.referer,
                        deviceType: clientInfo.deviceType,
                        browser: clientInfo.browser,
                        os: clientInfo.os,
                    },
                });
                break;
            }

            case "result_share": {
                // 归属校验：只允许 session 真正归属的用户触发分享加分
                // 若 sessionId 不属于当前登录用户，update 找不到记录会静默失败
                await prisma.advisorSession.updateMany({
                    where: { sessionId, userId: user.id },
                    data: {
                        resultShared: true,
                        shareMethod: (data?.method as string) || null,
                    },
                });
                break;
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        logger.error("Analytics track error:", error);
        // 返回错误状态码以便监控系统发现异常
        return NextResponse.json(
            { success: false, error: "Tracking failed" },
            { status: 500 }
        );
    }
}
