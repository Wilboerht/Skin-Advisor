/* 临时脚本：打开 FAQ 弹窗，验证 Dock 自动收起 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByText("常见问题").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "screenshots-check/dock-modal-mobile.png" });
  await page.close();

  const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page2.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page2.waitForTimeout(1500);
  await page2.getByText("常见问题").click();
  await page2.waitForTimeout(800);
  await page2.screenshot({ path: "screenshots-check/dock-modal-desktop.png", clip: { x: 0, y: 640, width: 1280, height: 160 } });
  await page2.close();

  await browser.close();
  console.log("done");
})();
