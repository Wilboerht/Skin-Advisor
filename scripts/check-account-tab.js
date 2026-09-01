/* 临时脚本：验证「我的」tab 弹登录框 + /profile 重定向 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  // 1. /profile 应重定向到首页
  await page.goto("http://localhost:3000/profile", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log("访问 /profile 后 URL:", page.url());

  // 2. 点 Dock「我的」→ 应弹登录框而非跳转
  await page.waitForSelector("text=我的", { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.getByText("我的", { exact: true }).click();
  try {
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    console.log("点击「我的」后：登录弹窗已打开");
  } catch {
    console.log("!! 点击「我的」后无弹窗");
  }
  console.log("点击后 URL:", page.url());
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots-check/dock-account-guest.png" });

  await browser.close();
  console.log("done");
})();
