import { NextRequest, NextResponse } from "next/server";
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
        const dailyLimit = limit.dailyLimit;
        const usedCount = Math.max(0, dailyLimit - limit.remaining);

        return NextResponse.json({
            canTest: limit.canTest,
            usedCount,
            dailyLimit,
            remaining: limit.remaining,
            isGuest: limit.role === 'guest',
            error: limit.error,
        });
    } catch (error) {
        console.error("Failed to check test limit:", error);
        return NextResponse.json({
            error: "Failed to check test limit"
        }, { status: 500 });
    }
}

// POST 端点已移除：test-limit 只做查询不做写入，GET 已足够。
// 保留此注释说明，防止误增冗余端点。
