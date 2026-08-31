/* 临时脚本：截取 /skin-types 页（移动 + 桌面） */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const shots = [
    { name: "skintypes-desktop", width: 1280, height: 800, mobile: false },
    { name: "skintypes-mobile", width: 390, height: 844, mobile: true },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
    });
    await page.goto("http://localhost:3000/skin-types", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("text=了解不同肌肤类型", { timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `screenshots-check/${s.name}.png` });
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
