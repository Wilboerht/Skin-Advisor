/* 临时脚本：护肤档案弹层验证（游客态 + mock 登录态） */
const { chromium } = require("playwright-core");

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  async function openDiary(page) {
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.waitForSelector('nav button:has-text("护肤档案")', { timeout: 60000 });
    await page.getByRole("button", { name: /护肤档案/ }).first().click();
    await page.waitForSelector("#diary-modal-title", { timeout: 15000 });
    await page.waitForTimeout(800);
  }

  async function guestCheck(page, name) {
    await openDiary(page);
    const body = await page.evaluate(() => document.body.textContent || "");
    const checks = [
      ["游客引导标题", body.includes("你的护肤档案")],
      ["功能胶囊", body.includes("里程碑记录") && body.includes("每日打卡")],
      ["登录 CTA", body.includes("登录 / 注册")],
      ["去测肤链接", body.includes("先去测肤，稍后再登录 →")],
      ["示意曲线存在", (await page.locator("svg").count()) > 0],
    ];
    let ok = true;
    for (const [n, pass] of checks) {
      console.log(`${pass ? "✓" : "✗"} ${name} ${n}`);
      if (!pass) ok = false;
    }
    await page.screenshot({ path: `screenshots-check/diary-modal-guest-${name}.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.close();
    return ok;
  }

  async function loggedInCheck(page, name) {
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "u1", phone: "13812341234", name: "Hank", avatar: null, role: "user" } }) })
    );
    await page.route("**/api/user/skin-trends", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { dates: [day(20), day(14), day(9), day(5), day(2), day(0)], scores: [72, 75, 74, 79, 81, 83] } }) })
    );
    await page.route("**/api/user/diary", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [
        { id: "e1", date: day(1), skinState: "good", tags: ["熬夜后"], note: "昨晚睡得晚，今天 T 区略油，整体状态还可以。" },
        { id: "e2", date: day(2), skinState: "great", tags: [], note: null },
        { id: "e3", date: day(5), skinState: "bad", tags: ["爆痘", "换季"], note: "下巴冒了两颗痘，暂停了视黄醇。" },
      ] }) })
    );
    await page.route("**/api/advisor/history**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history: [
        { sessionId: "s1", completedAt: day(0), analysisResult: { faceAnalysis: { overallScore: 83 }, skinProfile: { typeLabel: "混合肌" } } },
        { sessionId: "s2", completedAt: day(5), analysisResult: { faceAnalysis: { overallScore: 79 }, skinProfile: { typeLabel: "混合肌" } } },
      ], pagination: { page: 1, total: 2, totalPages: 1 } }) })
    );

    await openDiary(page);
    const body = await page.evaluate(() => document.body.textContent || "");
    const checks = [
      ["趋势标题", body.includes("测肤趋势")],
      ["趋势图存在", body.includes("最新综合评分")],
      ["历程时间线", body.includes("完成测肤")],
      ["打卡入口", body.includes("今天还没有打卡")],
      ["全部记录入口", body.includes("全部记录")],
    ];
    let ok = true;
    for (const [n, pass] of checks) {
      console.log(`${pass ? "✓" : "✗"} ${name} ${n}`);
      if (!pass) ok = false;
    }
    await page.screenshot({ path: `screenshots-check/diary-modal-user-${name}.png` });

    // 打开打卡二级弹层
    try {
      await page.getByText("今天还没有打卡").click();
      await page.waitForSelector("#checkin-modal-title", { timeout: 8000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `screenshots-check/diary-modal-checkin-${name}.png` });
      console.log(`✓ ${name} 打卡弹层叠加正常`);
      // 用关闭按钮退出（Escape 只关最上层，验证父弹层不随之关闭）
      await page.locator('button[aria-label="关闭"]').last().click();
      await page.waitForTimeout(600);
      const parentStillOpen = (await page.locator("#diary-modal-title").count()) > 0;
      console.log(`${parentStillOpen ? "✓" : "✗"} ${name} 关闭子弹层后父弹层仍在`);
      if (!parentStillOpen) ok = false;
    } catch (e) {
      console.log(`✗ ${name} 打卡弹层未打开`, String(e));
      ok = false;
    }

    // 打开全部记录二级弹层
    try {
      await page.getByText("全部记录").click();
      await page.waitForSelector("#history-modal-title", { timeout: 8000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screenshots-check/diary-modal-history-${name}.png` });
      console.log(`✓ ${name} 记录弹层叠加正常`);
    } catch (e) {
      console.log(`✗ ${name} 记录弹层未打开`, String(e));
      ok = false;
    }

    await page.close();
    return ok;
  }

  const m1 = await guestCheck(await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), "guest-mobile");
  const m2 = await guestCheck(await browser.newPage({ viewport: { width: 1440, height: 900 } }), "guest-desktop");
  const m3 = await loggedInCheck(await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), "user-mobile");
  const m4 = await loggedInCheck(await browser.newPage({ viewport: { width: 1440, height: 900 } }), "user-desktop");

  await browser.close();
  const all = m1 && m2 && m3 && m4;
  console.log(all ? "ALL PASS" : "SOME FAILED");
  process.exit(all ? 0 : 1);
})();
