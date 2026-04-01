import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
    extractGuestIdentifiers,
    checkGuestLimit,
    recordGuestTest,
    DEFAULT_GUEST_LIMIT
} from "@/lib/guest-limit";

// GET: 检查是否可以测试
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const guestId = searchParams.get('guestId'); // 兼容旧版本
        const cookieId = searchParams.get('cookieId');
        const fingerprint = searchParams.get('fingerprint');

        // 检查是否登录用户
        const session = await getSession();

        // 获取今天的日期范围
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (session) {
            // 登录用户：获取用户信息和限制
            const user = await prisma.user.findUnique({
                where: { id: session.id },
                select: { dailyTestLimit: true }
            });
            const dailyLimit = user?.dailyTestLimit || 10;

            // 统计今日测试次数
            const todayCount = await prisma.testRecord.count({
                where: {
                    userId: session.id,
                    testDate: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });

            return NextResponse.json({
                canTest: todayCount < dailyLimit,
                usedCount: todayCount,
                dailyLimit: dailyLimit,
                remaining: Math.max(0, dailyLimit - todayCount),
                isGuest: false
            });
        } else {
            // 游客：使用多维度验证
            const identifiers = extractGuestIdentifiers(request, {
                cookieId: cookieId || undefined,
                fingerprint: fingerprint || guestId || undefined
            });

            const limitResult = await checkGuestLimit(identifiers);

            return NextResponse.json({
                canTest: limitResult.canTest,
                usedCount: limitResult.usedCount,
                dailyLimit: limitResult.dailyLimit,
                remaining: limitResult.remaining,
                isGuest: true,
                isBlocked: limitResult.isBlocked,
                blockReason: limitResult.blockReason,
                matchedBy: limitResult.matchedBy,
                confidenceScore: limitResult.confidenceScore
            });
        }
    } catch (error) {
        console.error("Failed to check test limit:", error);
        // 提供详细的错误信息用于诊断
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error("Error stack:", errorStack);
        return NextResponse.json({ 
            error: "Failed to check test limit",
            details: errorMessage 
        }, { status: 500 });
    }
}

// POST: 记录一次测试
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { guestId, sessionId, cookieId, fingerprint } = body;

        // 检查是否登录用户
        const session = await getSession();

        // 获取今天的日期范围
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (session) {
            // 登录用户：获取用户信息和限制
            const user = await prisma.user.findUnique({
                where: { id: session.id },
                select: { dailyTestLimit: true }
            });
            const dailyLimit = user?.dailyTestLimit || 10;

            // 检查是否已达到限制
            const todayCount = await prisma.testRecord.count({
                where: {
                    userId: session.id,
                    testDate: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });

            if (todayCount >= dailyLimit) {
                return NextResponse.json({
                    success: false,
                    error: "已达到今日测试次数上限",
                    canTest: false,
                    usedCount: todayCount,
                    dailyLimit: dailyLimit
                }, { status: 429 });
            }

            // 记录测试
            await prisma.testRecord.create({
                data: {
                    userId: session.id,
                    sessionId: sessionId
                }
            });

            return NextResponse.json({
                success: true,
                usedCount: todayCount + 1,
                dailyLimit: dailyLimit,
                remaining: dailyLimit - todayCount - 1
            });
        } else {
            // 游客：使用多维度验证和记录
            const identifiers = extractGuestIdentifiers(request, {
                cookieId: cookieId || undefined,
                fingerprint: fingerprint || guestId || undefined
            });

            const result = await recordGuestTest(identifiers, sessionId);

            if (!result.success) {
                return NextResponse.json({
                    success: false,
                    error: result.error || "已达到今日测试次数上限，登录后可获得更多测试次数",
                    canTest: false,
                    usedCount: result.usedCount,
                    dailyLimit: DEFAULT_GUEST_LIMIT
                }, { status: 429 });
            }

            return NextResponse.json({
                success: true,
                usedCount: result.usedCount,
                dailyLimit: DEFAULT_GUEST_LIMIT,
                remaining: DEFAULT_GUEST_LIMIT - result.usedCount
            });
        }
    } catch (error) {
        console.error("Failed to record test:", error);
        // 提供详细的错误信息用于诊断
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error("Error stack:", errorStack);
        return NextResponse.json({ 
            error: "Failed to record test",
            details: errorMessage 
        }, { status: 500 });
    }
}
