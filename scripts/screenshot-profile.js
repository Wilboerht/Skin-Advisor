/* 临时脚本：截取 /profile 未登录预览 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000/profile", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(15000);
  console.log("URL:", page.url());
  await page.screenshot({ path: "screenshots-check/profile-guest-mobile.png" });
  await browser.close();
  console.log("done");
})();
