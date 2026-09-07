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
            // allowed 与 canTest 同义，供新版前端/主站读取；旧字段保持兼容
            allowed: limit.canTest,
            usedCount,
            dailyLimit,
            remaining: limit.remaining,
            quotaPeriod: limit.quotaPeriod ?? 'day',
            isGuest: limit.role === 'guest',
            error: limit.error,
            message: limit.error,
            // 游客：需登录后才能测肤
            ...(limit.requireLogin ? { requireLogin: true } : {}),
            // 登录用户：会员档位与用量明细
            ...(limit.level ? { level: limit.level } : {}),
            ...(limit.usage ? { usage: limit.usage } : {}),
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
