/* 临时脚本：截取首页桌面/移动端的 Dock 区域，核对激活指示器样式 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const shots = [
    { name: "dock-desktop", width: 1280, height: 800, mobile: false },
    { name: "dock-mobile", width: 390, height: 844, mobile: true },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
    });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // 只截 Dock 区域（底部 160px）
    await page.screenshot({
      path: `screenshots-check/${s.name}.png`,
      clip: { x: 0, y: s.height - 160, width: s.width, height: 160 },
    });
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
