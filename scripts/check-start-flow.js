/* 临时脚本：skin-types 活动弹窗点"开始测肤"，验证 ?start=1 自动拉起测肤流程 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000/skin-types", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=抽奖赢好礼", { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.getByText("参与「肌智派」活动，抽奖赢好礼").first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.getByText("开始测肤").click();
  await page.waitForTimeout(12000);
  console.log("当前 URL:", page.url());
  const dialog = await page.$('[role="dialog"]');
  console.log("页面上是否存在弹窗(授权/限额):", !!dialog);
  await page.screenshot({ path: "screenshots-check/start-flow-result.png" });
  await browser.close();
  console.log("done");
})();
