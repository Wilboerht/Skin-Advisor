/* 临时脚本：skin-types 页点击活动入口，验证 GiftModal 原地打开 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000/skin-types", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("text=抽奖赢好礼", { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.getByText("参与「肌智派」活动，抽奖赢好礼").first().click();
  try {
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    console.log("弹窗已打开");
  } catch {
    console.log("!! 弹窗未出现");
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "screenshots-check/skintypes-gift-modal.png" });
  console.log("当前 URL:", page.url());
  await browser.close();
  console.log("done");
})();
