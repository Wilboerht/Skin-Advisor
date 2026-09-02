/* 临时脚本：myskin.org 风格复刻演示页截图 + 断言 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  async function shoot(name, viewport) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await page.goto("http://localhost:3000/preview/myskin", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    const body = await page.evaluate(() => document.body.textContent || "");
    const checks = [
      ["Hero 大标题", body.includes("共同打造的测肤档案体系")],
      ["墨绿引导词", body.includes("我们致力于理解肌肤如何随时间变化")],
      ["CTA 开始测肤", body.includes("开始测肤")],
      ["感谢拱文案", body.includes("帮助更多人理解皮肤科学的真相")],
      ["常见问题", body.includes("常见问题") && body.includes("测肤需要多长时间")],
      ["Footer 演示标注", body.includes("myskin.org 风格复刻演示")],
    ];
    let ok = true;
    for (const [n, pass] of checks) {
      console.log(`${pass ? "✓" : "✗"} ${name} ${n}`);
      if (!pass) ok = false;
    }

    await page.screenshot({ path: `screenshots-check/myskin-preview-${name}.png`, fullPage: true });
    console.log(`${name} screenshot saved`);
    await page.close();
    return ok;
  }

  const m = await shoot("mobile", { width: 390, height: 844 });
  const d = await shoot("desktop", { width: 1440, height: 900 });

  await browser.close();
  console.log(m && d ? "ALL PASS" : "SOME FAILED");
  process.exit(m && d ? 0 : 1);
})();
