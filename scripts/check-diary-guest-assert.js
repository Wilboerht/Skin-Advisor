/* 临时脚本：游客态 /diary 全屏 Hero 断言（版式参考 Myskin.Today 首页） */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  async function check(name, viewport) {
    const page = await browser.newPage({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await page.goto("http://localhost:3000/diary", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    // HMR 编译时序容错：首次加载未出 Hero（旧 chunk）时刷新重试
    const hasHero = await page.evaluate(() =>
      [...document.querySelectorAll("h1")].some((el) => el.textContent.includes("始于每一次测肤"))
    );
    if (!hasHero) {
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(5000);
    }

    const body = await page.evaluate(() => document.body.textContent || "");
    const checks = [
      ["徽章 pill", body.includes("AI Skincare Archive")],
      ["主标题", body.includes("护肤档案，")],
      ["副标题", body.includes("始于每一次测肤。")],
      ["副文案", body.includes("登录后自动同步")],
      ["CTA 登录", body.includes("登录 / 注册")],
      ["CTA 去测肤", body.includes("先去测肤 →")],
      ["胶囊标识", body.includes("里程碑记录") && body.includes("每日肌肤打卡")],
      ["插画卡片", body.includes("综合评分走势 · 自动记录每一次测肤")],
      ["无假数据", !body.includes("82 分") && !body.includes("混合肌") && !body.includes("示例数据")],
    ];
    let ok = true;
    for (const [n, pass] of checks) {
      console.log(`${pass ? "✓" : "✗"} ${name} ${n}`);
      if (!pass) ok = false;
    }

    const layout = await page.evaluate(() => {
      const h1 = [...document.querySelectorAll("h1")].find((el) => el.textContent.includes("始于每一次测肤"));
      if (!h1) return null;
      const section = h1.closest("section");
      const illus = [...document.querySelectorAll("*")].find((el) => el.textContent.trim() === "综合评分走势 · 自动记录每一次测肤" && el.tagName === "P" && el.getAttribute("class")?.includes("text-brand-charcoal/45"));
      const innerHeight = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;
      const h1Rect = h1.getBoundingClientRect();
      const title = [...document.querySelectorAll("h1")];
      const isLeft = title.length > 0 && h1Rect.left < window.innerWidth / 2;
      const illRight = illus ? illus.getBoundingClientRect().left > window.innerWidth / 2 : true; // 桌面右图
      return { oneScreen: scrollHeight <= innerHeight, scrollHeight, innerHeight, h1Left: Math.round(h1Rect.left), illRight };
    });
    if (!layout) {
      console.log(`✗ ${name} 未找到 Hero 标题`);
      ok = false;
    } else {
      console.log(`${layout.oneScreen ? "✓" : "✗"} ${name} 一屏显示（${layout.scrollHeight}px ≤ ${layout.innerHeight}px）`);
      console.log(`  h1 左边缘 ${layout.h1Left}px / 视口 ${viewport.width}px`);
      if (!layout.oneScreen) ok = false;
    }

    await page.screenshot({ path: `screenshots-check/diary-hero-${name}.png`, fullPage: true });
    await page.close();
    return ok;
  }

  const m1 = await check("mobile", { width: 390, height: 844 });
  const m2 = await check("small", { width: 375, height: 667 });
  const d = await check("desktop", { width: 1440, height: 900 });

  await browser.close();
  const all = m1 && m2 && d;
  console.log(all ? "ALL PASS" : "SOME FAILED");
  process.exit(all ? 0 : 1);
})();
