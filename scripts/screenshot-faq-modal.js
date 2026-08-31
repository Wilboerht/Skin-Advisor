/* 临时脚本：打开 FAQ 模态框截图（移动 + 桌面），验证样式对齐与 Dock 收起 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const shots = [
    { name: "faq-v2-mobile", width: 390, height: 844, mobile: true },
    { name: "faq-v2-desktop", width: 1280, height: 800, mobile: false },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
    });
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("text=常见问题", { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByText("常见问题").click();
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots-check/${s.name}.png` });
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
