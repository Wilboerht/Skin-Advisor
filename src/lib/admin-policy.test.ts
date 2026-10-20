import { afterEach, describe, it, expect, vi } from "vitest";
import {
    DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE,
    getAdminTotpEnforcementDate,
    isAdminTotpRequired,
    shouldBlockSsoAdminWithoutTotp,
} from "./admin-policy";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("admin-policy TOTP enforcement", () => {
    it("默认截止时间为 2027-11-01", () => {
        expect(getAdminTotpEnforcementDate("")?.toISOString()).toBe(
            new Date(DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE).toISOString()
        );
    });

    it("支持显式关闭", () => {
        expect(getAdminTotpEnforcementDate("off")).toBeNull();
        expect(getAdminTotpEnforcementDate("false")).toBeNull();
        expect(getAdminTotpEnforcementDate("0")).toBeNull();
    });

    it("非法值回退默认截止时间", () => {
        expect(getAdminTotpEnforcementDate("not-a-date")?.toISOString()).toBe(
            new Date(DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE).toISOString()
        );
    });

    it("截止时间前后判断正确", () => {
        vi.stubEnv("ADMIN_TOTP_ENFORCEMENT_DATE", "2026-01-01T00:00:00+08:00");
        expect(isAdminTotpRequired(new Date("2025-12-31T15:59:59.000Z"))).toBe(false);
        expect(isAdminTotpRequired(new Date("2025-12-31T16:00:00.000Z"))).toBe(true);
    });

    it("关闭后不再强制", () => {
        vi.stubEnv("ADMIN_TOTP_ENFORCEMENT_DATE", "off");
        expect(isAdminTotpRequired(new Date("2030-01-01T00:00:00.000Z"))).toBe(false);
    });

    it("只拦截未开启 TOTP 的 SSO 管理员", () => {
        vi.stubEnv("ADMIN_TOTP_ENFORCEMENT_DATE", "2027-11-01T00:00:00+08:00");
        const now = new Date("2027-11-02T00:00:00+08:00");
        expect(shouldBlockSsoAdminWithoutTotp(false, now)).toBe(true);
        expect(shouldBlockSsoAdminWithoutTotp(null, now)).toBe(true);
        expect(shouldBlockSsoAdminWithoutTotp(undefined, now)).toBe(true);
        expect(shouldBlockSsoAdminWithoutTotp(true, now)).toBe(false);

        const before = new Date("2027-10-31T00:00:00+08:00");
        expect(shouldBlockSsoAdminWithoutTotp(false, before)).toBe(false);
        expect(shouldBlockSsoAdminWithoutTotp(true, before)).toBe(false);
    });
});
