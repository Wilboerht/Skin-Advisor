/* 临时脚本：护肤档案页游客态截图（营销预览方案 D） */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  async function shoot(name, viewport) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await page.goto("http://localhost:3000/diary", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `screenshots-check/diary-guest-preview-${name}.png`, fullPage: true });
    console.log(`${name} done`);
    await page.close();
  }

  await shoot("mobile", { width: 390, height: 844 });
  await shoot("desktop", { width: 1440, height: 900 });

  await browser.close();
  console.log("done");
})();
