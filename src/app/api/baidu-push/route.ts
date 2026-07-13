import { NextRequest, NextResponse } from "next/server";
import { pushUrlsToBaidu, getAllSiteUrls } from "@/lib/baidu-push";

/**
 * GET /api/baidu-push?token=xxx
 * 用于百度站长平台设置定时推送任务
 * 每天凌晨自动调用此接口推送全部 URL
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";
  const baiduToken = process.env.BAIDU_PUSH_TOKEN;

  if (!baiduToken) {
    return NextResponse.json(
      { error: "BAIDU_PUSH_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    const urls = getAllSiteUrls(site);
    const result = await pushUrlsToBaidu(site, baiduToken, urls);

    return NextResponse.json({
      success: true,
      pushed: result.success,
      remain: result.remain,
      total: urls.length,
      urls,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
