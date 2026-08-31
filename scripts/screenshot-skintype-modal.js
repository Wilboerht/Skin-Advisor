/* 临时脚本：skin-types 页点击卡片打开详情弹窗并截图 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const shots = [
    { name: "skintype-modal-mobile", width: 390, height: 844, mobile: true },
    { name: "skintype-modal-desktop", width: 1280, height: 800, mobile: false },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
    });
    const logs = [];
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type())) logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
    await page.goto("http://localhost:3000/skin-types", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("text=敏敏派", { timeout: 60000 });
    // 等待 dev 编译完成后再刷新一次，避免 HMR 全页刷新重置弹窗状态
    await page.waitForTimeout(6000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=敏敏派", { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByText("敏敏派").first().click();
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
    } catch {
      console.log(`!! ${s.name}: 8 秒内未出现 [role=dialog]`);
    }
    console.log(logs.join("\n") || "(无控制台错误)");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots-check/${s.name}.png` });
    await page.close();
  }

  await browser.close();
  console.log("done");
})();
