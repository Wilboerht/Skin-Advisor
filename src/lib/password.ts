/**
 * 密码强度校验工具
 *
 * 与官网 nihplod.cn 的 src/lib/password.ts 对齐：
 * - 至少 8 位，最多 32 位
 * - 包含至少一个大写字母
 * - 包含至少一个小写字母
 * - 包含至少一个数字
 * - 拒绝常见弱密码与连续/重复字符
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

const WEAK_PASSWORD_BLACKLIST = new Set([
    "123456",
    "12345678",
    "123456789",
    "1234567890",
    "password",
    "qwerty",
    "abc123",
    "111111",
    "000000",
    "iloveyou",
    "admin123",
    "password123",
    "letmein",
    "welcome",
    "monkey",
    "dragon",
    "master",
    "sunshine",
    "princess",
    "football",
    "baseball",
    "superman",
    "batman",
    "password1",
    "qwerty123",
    "1q2w3e4r",
    "passw0rd",
    "changeme",
    "123456789a",
    "abc123456",
    "adminadmin",
    "testtest",
    "guestguest",
]);

const SEQUENTIAL_DIGITS =
    /(012345|123456|234567|345678|456789|567890|098765|987654|876543|765432|654321|543210)/;
const SEQUENTIAL_LETTERS =
    /(abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|mnopqr|nopqrs|opqrst|pqrstu|qrstuv|rstuvw|stuvwx|tuvwxy|uvwxyz|zyxwvu|yxwvut|xwvuts|wvutsr|vutsrq|utsrqp|tsrqpo|srqpon|rqponm|qponml|ponmlk|onmlkj|nmlkji|mlkjih|lkjihg|kjihgf|jihgfe|ihgfed|hgfedc|gfedcb|fedcba)/;

export function isWeakPassword(password: string): boolean {
    if (!password) return true;
    const lower = password.toLowerCase();
    if (WEAK_PASSWORD_BLACKLIST.has(lower)) return true;
    if (/^(.)\1+$/.test(password)) return true;
    if (SEQUENTIAL_DIGITS.test(password)) return true;
    if (SEQUENTIAL_LETTERS.test(lower)) return true;
    return false;
}

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
    if (isWeakPassword(password)) {
        return { valid: false, message: "密码过于简单，请避免使用常见弱密码或连续字符" };
    }
    return { valid: true };
}
