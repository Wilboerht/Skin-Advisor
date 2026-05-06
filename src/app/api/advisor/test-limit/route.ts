import { NextRequest, NextResponse } from "next/server";
import { getSession, isVipCheck } from "@/lib/auth";
import {
    extractGuestIdentifiers,
    checkGuestLimit,
    DEFAULT_GUEST_LIMIT
} from "@/lib/guest-limit";
import { checkUsageLimit } from "@/lib/usage-limit";

// GET: 检查是否可以测试（复用 checkUsageLimit 保证与 analyze API 逻辑一致）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const guestId = searchParams.get('guestId');
        const cookieId = searchParams.get('cookieId');
        const fingerprint = searchParams.get('fingerprint');

        const body = {
            cookieId: cookieId || undefined,
            fingerprint: fingerprint || guestId || undefined
        };

        const limit = await checkUsageLimit(request, body);
        const dailyLimit = limit.role === 'vip' ? 100 : limit.role === 'member' ? 10 : DEFAULT_GUEST_LIMIT;
        const usedCount = Math.max(0, dailyLimit - limit.remaining);

        // 访客额外获取详细元数据（置信度、匹配方式等）
        let guestMeta: Record<string, unknown> = {};
        if (limit.role === 'guest') {
            const identifiers = extractGuestIdentifiers(request, body);
            const guestLimit = await checkGuestLimit(identifiers);
            guestMeta = {
                isBlocked: guestLimit.isBlocked,
                blockReason: guestLimit.blockReason,
                matchedBy: guestLimit.matchedBy,
                confidenceScore: guestLimit.confidenceScore
            };
        }

        return NextResponse.json({
            canTest: limit.canTest,
            usedCount,
            dailyLimit,
            remaining: limit.remaining,
            isGuest: limit.role === 'guest',
            error: limit.error,
            ...guestMeta
        });
    } catch (error) {
        console.error("Failed to check test limit:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: "Failed to check test limit",
            details: errorMessage
        }, { status: 500 });
    }
}

// POST 端点已移除：test-limit 只做查询不做写入，GET 已足够。
// 保留此注释说明，防止误增冗余端点。
