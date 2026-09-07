import { NextRequest, NextResponse } from "next/server";
import { checkUsageLimit } from "@/lib/usage-limit";

// GET: 检查是否可以测试（复用 checkUsageLimit 保证与 analyze API 逻辑一致）
// 额度按登录态判定，不再接收 cookieId/fingerprint 等游客标识参数
export async function GET(request: NextRequest) {
    try {
        const limit = await checkUsageLimit(request);

        return NextResponse.json({
            canTest: limit.canTest,
            dailyLimit: limit.dailyLimit,
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
