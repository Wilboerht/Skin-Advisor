/* 临时脚本：打开 FAQ 模态框，捕获控制台错误/警告 */
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/hongk/AppData/Local/ms-playwright/chromium-1187/chrome-win/chrome.exe",
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const logs = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
  page.on("requestfailed", (req) => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("=== 首页加载后 ===");
  console.log(logs.join("\n") || "(无)");
  logs.length = 0;

  await page.getByText("常见问题").click();
  await page.waitForTimeout(1500);
  console.log("=== 打开 FAQ 模态框后 ===");
  console.log(logs.join("\n") || "(无)");

  await page.screenshot({ path: "screenshots-check/faq-modal-mobile.png" });
  await browser.close();
  console.log("done");
})();
