/* 临时脚本：截取首页完整视口（桌面/移动端），核对一屏布局 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const shots = [
    { name: "home-v2-desktop", width: 1280, height: 800, mobile: false },
    { name: "home-v2-mobile", width: 390, height: 844, mobile: true },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
    });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `screenshots-check/${s.name}.png` });
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
