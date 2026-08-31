/**
 * 百度链接主动推送 (主动收录)
 * 文档: https://ziyuan.baidu.com/linksubmit/
 *
 * 使用方式:
 *   - 首次提交: npx tsx scripts/baidu-push.ts
 *   - 定时推送: 在百度站长平台设置 Cron: GET /api/baidu-push?token=xxx
 */

const BAIDU_PUSH_URL = "http://data.zz.baidu.com";

interface PushResult {
  success: number;
  remain: number;
}

/**
 * 向百度主动推送 URL
 */
export async function pushUrlsToBaidu(
  site: string,
  token: string,
  urls: string[]
): Promise<PushResult> {
  const apiUrl = `${BAIDU_PUSH_URL}/urls?site=${encodeURIComponent(site)}&token=${token}`;

  const body = urls.join("\n");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Baidu push failed: HTTP ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(`Baidu push error: ${result.message}`);
  }

  return {
    success: result.success ?? 0,
    remain: result.remain ?? 0,
  };
}

/**
 * 获取所有需要推送的 URL 列表 (对应 sitemap 内容)
 */
export function getAllSiteUrls(baseUrl: string): string[] {
  const urls: string[] = [];

  // 首页
  urls.push(baseUrl);

  // 静态页面
  urls.push(`${baseUrl}/skin-types`);
  urls.push(`${baseUrl}/services`);
  urls.push(`${baseUrl}/faq`);

  return urls;
}
