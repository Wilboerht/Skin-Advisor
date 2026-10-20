/**
 * 管理员账号策略（与具体路由解耦，便于单测）
 */

export const DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE = "2027-11-01T00:00:00+08:00";

/**
 * 读取 TOTP 强制截止时间。
 * - 未配置：使用默认 2027-11-01（与后台提示一致）
 * - 配置为 off/false/0：关闭强制
 * - 配置为非法值：回退默认值，避免因误配导致策略永久失效
 */
export function getAdminTotpEnforcementDate(
    raw: string | undefined = process.env.ADMIN_TOTP_ENFORCEMENT_DATE
): Date | null {
    const value = raw?.trim();
    if (value === "off" || value === "false" || value === "0") {
        return null;
    }
    const parsed = new Date(value || DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE);
    if (Number.isNaN(parsed.getTime())) {
        return new Date(DEFAULT_ADMIN_TOTP_ENFORCEMENT_DATE);
    }
    return parsed;
}

/** 是否已到强制 TOTP 的截止时间 */
export function isAdminTotpRequired(now: Date = new Date()): boolean {
    const deadline = getAdminTotpEnforcementDate();
    return deadline !== null && now.getTime() >= deadline.getTime();
}

/**
 * SSO 管理员是否因未开启主站 TOTP 而被拦截。
 * break-glass / local 账号不走该策略。
 */
export function shouldBlockSsoAdminWithoutTotp(
    mainTotpEnabled: boolean | null | undefined,
    now: Date = new Date()
): boolean {
    return isAdminTotpRequired(now) && mainTotpEnabled !== true;
}
