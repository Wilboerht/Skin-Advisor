/**
 * 密码强度校验工具
 *
 * 与官网 nihplod.cn 的 src/lib/password.ts 对齐：
 * - 至少 8 位，最多 32 位
 * - 包含至少一个大写字母
 * - 包含至少一个小写字母
 * - 包含至少一个数字
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

export interface PasswordValidationResult {
    valid: boolean;
    message?: string;
}

/**
 * 校验密码强度，返回 { valid, message }。
 * valid 为 true 时表示符合官网要求。
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { valid: false, message: `密码至少${PASSWORD_MIN_LENGTH}位` };
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        return { valid: false, message: `密码最多${PASSWORD_MAX_LENGTH}位` };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "密码需包含大写字母" };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: "密码需包含小写字母" };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: "密码需包含数字" };
    }
    return { valid: true };
}
