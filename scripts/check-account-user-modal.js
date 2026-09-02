/* 临时脚本：mock 登录态，验证「我的」已登录弹层样式 */
const { chromium } = require("playwright-core");

const MOCK_USER = {
  user: {
    id: "mock-user-id",
    phone: "13812341234",
    name: "Hank",
    avatar: null,
    role: "user",
    membershipLevel: "ADVANCED",
  },
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  async function shoot(page, name) {
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_USER) })
    );
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("text=我的", { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.getByText("我的", { exact: true }).first().click();
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      console.log(`${name}：弹层已打开`);
    } catch {
      console.log(`!! ${name}：无弹层`);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `screenshots-check/dock-account-user-${name}.png` });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await shoot(mobile, "mobile");

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await shoot(desktop, "desktop");

  await browser.close();
  console.log("done");
})();
