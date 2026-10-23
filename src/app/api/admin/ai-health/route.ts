import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getAdvisorAIHealth } from "@/lib/admin-ai-health";

/**
 * Admin AI 服务健康检查 API
 * GET /api/admin/ai-health
 * 返回 AI 预算使用率、熔断器状态等实时健康指标
 */
export const GET = withAdminAuth(async () => {
    try {
        const health = await getAdvisorAIHealth();
        return NextResponse.json(health, {
            headers: {
                "Cache-Control": "no-cache, no-store, max-age=0",
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
});
