import { NextResponse } from "next/server";
import { getAISettings } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const settings = await getAISettings();
        const provider = settings.provider;
        const keys = settings.apiKeys || {};
        const key = keys[provider];

        if (!key) {
            return NextResponse.json({
                configured: false,
                message: "AI 服务尚未配置，请先设置 API 密钥后再进行测试。",
            });
        }

        return NextResponse.json({ configured: true });
    } catch {
        return NextResponse.json({
            configured: false,
            message: "无法获取 AI 配置，请稍后重试。",
        });
    }
}
