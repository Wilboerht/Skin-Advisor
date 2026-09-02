/* 临时脚本：护肤档案页截图（游客态 + mock 登录态） */
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

  async function shootLoggedIn(page, name) {
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
      ] }) })
    );
    await page.goto("http://localhost:3000/diary", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `screenshots-check/diary-user-${name}.png`, fullPage: true });
    console.log(`${name} done`);

    // 打开打卡弹层截图（mock 数据今天有测肤事件，入口是补打引导条）
    try {
      await page.getByText("今天还没有打卡").click();
      await page.waitForSelector("#checkin-modal-title", { timeout: 8000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `screenshots-check/diary-checkin-${name}.png` });
      console.log(`${name} checkin modal done`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`!! ${name} 打卡弹层未打开`, String(e));
    }

    // 打开全部测肤记录弹层截图
    try {
      await page.getByText("全部记录").click();
      await page.waitForSelector("#history-modal-title", { timeout: 8000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screenshots-check/diary-history-${name}.png` });
      console.log(`${name} history modal done`);
    } catch (e) {
      console.log(`!! ${name} 记录弹层未打开`, String(e));
    }
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto("http://localhost:3000/diary", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobile.waitForTimeout(4000);
  await mobile.screenshot({ path: "screenshots-check/diary-guest-mobile.png", fullPage: true });
  console.log("guest mobile done");

  await shootLoggedIn(await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), "mobile");
  await shootLoggedIn(await browser.newPage({ viewport: { width: 1440, height: 900 } }), "desktop");

  await browser.close();
  console.log("done");
})();
