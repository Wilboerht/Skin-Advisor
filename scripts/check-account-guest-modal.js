/* 临时脚本：验证「我的」未登录弹层样式 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  // 移动端
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobile.waitForSelector("text=我的", { timeout: 60000 });
  await mobile.waitForTimeout(3000);
  await mobile.getByText("我的", { exact: true }).click();
  try {
    await mobile.waitForSelector('[role="dialog"]', { timeout: 10000 });
    console.log("移动端：弹层已打开");
  } catch {
    console.log("!! 移动端：无弹层");
  }
  await mobile.waitForTimeout(800);
  await mobile.screenshot({ path: "screenshots-check/dock-account-guest.png" });

  // 桌面端
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await desktop.waitForSelector("text=我的", { timeout: 60000 });
  await desktop.waitForTimeout(3000);
  await desktop.getByText("我的", { exact: true }).first().click();
  try {
    await desktop.waitForSelector('[role="dialog"]', { timeout: 10000 });
    console.log("桌面端：弹层已打开");
  } catch {
    console.log("!! 桌面端：无弹层");
  }
  await desktop.waitForTimeout(800);
  await desktop.screenshot({ path: "screenshots-check/dock-account-guest-desktop.png" });

  await browser.close();
  console.log("done");
})();
