/**
 * 首次使用：批量推送全部 URL 到百度
 *
 * 运行方式:
 *   npx tsx scripts/baidu-push.ts
 *
 * 前置条件:
 *   在 .env.production 中配置 BAIDU_PUSH_TOKEN
 */

import { config } from "dotenv";
import { pushUrlsToBaidu, getAllSiteUrls } from "../src/lib/baidu-push";

config({ path: ".env.production" });

async function main() {
  const site = process.env.NEXT_PUBLIC_BASE_URL || "https://nihplod.cn";
  const token = process.env.BAIDU_PUSH_TOKEN;

  if (!token) {
    console.error("错误: 请在 .env.production 中设置 BAIDU_PUSH_TOKEN");
    console.error(
      "获取方式: 百度站长平台 → 站点管理 → 普通收录 → 接口调用地址中的 token 参数"
    );
    process.exit(1);
  }

  const urls = getAllSiteUrls(site);
  console.log(`准备推送 ${urls.length} 条 URL 到百度:\n`);
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  console.log();

  try {
    const result = await pushUrlsToBaidu(site, token, urls);
    console.log(`推送成功! 成功 ${result.success} 条，今日剩余配额 ${result.remain} 条`);
  } catch (error) {
    console.error("推送失败:", error);
    process.exit(1);
  }
}

main();
