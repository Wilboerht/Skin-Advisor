import { describe, it, expect } from "vitest";
import { isMobileDevice, isWeChatBrowser } from "./share-device";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Microsoft Edge/120.0.0.0";
const WECHAT_IOS_UA = `${IPHONE_UA} MicroMessenger/8.0.47(0x18002f2c) NetType/WIFI Language/zh_CN`;
const WECHAT_WINDOWS_UA = `${WINDOWS_UA} MicroMessenger/3.9.8.15(0x63090826) WindowsWechat(0x63090c11) XWEB/1170`;

describe("isMobileDevice", () => {
    it("识别 iPhone / Android", () => {
        expect(isMobileDevice(IPHONE_UA, 5)).toBe(true);
        expect(isMobileDevice(ANDROID_UA, 5)).toBe(true);
    });

    it("iPad 桌面版 UA（Macintosh）按触屏识别为移动端", () => {
        expect(isMobileDevice(IPAD_DESKTOP_UA, 5)).toBe(true);
    });

    it("桌面 Windows 不带触屏为桌面端", () => {
        expect(isMobileDevice(WINDOWS_UA, 0)).toBe(false);
    });

    it("触屏 Windows 笔记本（maxTouchPoints > 1）仍视为桌面端", () => {
        expect(isMobileDevice(WINDOWS_UA, 10)).toBe(false);
        expect(isMobileDevice(WECHAT_WINDOWS_UA, 10)).toBe(false);
    });
});

describe("isWeChatBrowser", () => {
    it("识别移动端与桌面端微信内置浏览器", () => {
        expect(isWeChatBrowser(WECHAT_IOS_UA)).toBe(true);
        expect(isWeChatBrowser(WECHAT_WINDOWS_UA)).toBe(true);
    });

    it("普通浏览器返回 false", () => {
        expect(isWeChatBrowser(IPHONE_UA)).toBe(false);
        expect(isWeChatBrowser(WINDOWS_UA)).toBe(false);
    });
});
