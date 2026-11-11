/**
 * 服务端签发上传对象的命名规则（唯一事实源）
 *
 * 面部/游客临时上传：`guest/<16位标识哈希>/<YYYY-MM-DD>/<uuid>.<ext>`
 * 用户头像永久上传：`avatars/<16位标识哈希>/<YYYY-MM-DD>/<uuid>.<ext>`
 *
 * 用途：
 * - `local-upload` 只接受符合规则的路径（防止覆盖 products/ 等永久资产）；
 * - 面部照片清理只允许删除 `guest/` 对象，绝不能误删头像；
 * - 头像目录由 data-cleanup 豁免，避免 30 天后头像 404。
 */

import crypto from "crypto";

const UUID_PART =
    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXT_PART = "(jpg|jpeg|png|webp|gif)";

const GUEST_UPLOAD_RE = new RegExp(
    `^guest/[0-9a-f]{16}/\\d{4}-\\d{2}-\\d{2}/${UUID_PART}\\.${EXT_PART}$`,
    "i"
);
const AVATAR_UPLOAD_RE = new RegExp(
    `^avatars/[0-9a-f]{16}/\\d{4}-\\d{2}-\\d{2}/${UUID_PART}\\.${EXT_PART}$`,
    "i"
);

function toManagedPath(pathOrUrl: string): string | null {
    let pathname = pathOrUrl;
    if (/^https?:\/\//i.test(pathOrUrl)) {
        try {
            pathname = new URL(pathOrUrl).pathname;
        } catch {
            return null;
        }
    }
    return pathname.replace(/^\/+/, "").replace(/^uploads\//, "");
}

/**
 * 是否属于服务端签发的面部/游客临时上传对象。
 * 支持：`guest/...`、`uploads/guest/...`、`/uploads/guest/...`、`https://host/guest/...`
 */
export function isManagedUploadPath(pathOrUrl: string | null | undefined): boolean {
    if (!pathOrUrl) return false;
    const pathname = toManagedPath(pathOrUrl);
    return pathname ? GUEST_UPLOAD_RE.test(pathname) : false;
}

/** 当前登录用户在 guest/ 临时目录中的稳定前缀哈希（与 oss/sign 签发口径一致） */
export function guestUploadOwnerHash(userId: string): string {
    return crypto.createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

/**
 * 校验 guest 上传对象是否属于指定用户。
 * 仅校验形状合法且 owner hash 匹配，防止拿到他人 URL 后分析/删除他人人脸照片。
 */
export function isOwnedGuestUploadPath(
    pathOrUrl: string | null | undefined,
    userId: string | null | undefined
): boolean {
    if (!pathOrUrl || !userId) return false;
    if (!isManagedUploadPath(pathOrUrl)) return false;
    const pathname = toManagedPath(pathOrUrl);
    if (!pathname) return false;
    const expected = `guest/${guestUploadOwnerHash(userId)}/`;
    return pathname.startsWith(expected);
}

/**
 * 是否属于服务端签发的头像上传对象。
 * 头像与面部照片分开，避免 Nginx `guest/` 404 和 30 天清理误伤。
 */
export function isAvatarUploadPath(pathOrUrl: string | null | undefined): boolean {
    if (!pathOrUrl) return false;
    const pathname = toManagedPath(pathOrUrl);
    return pathname ? AVATAR_UPLOAD_RE.test(pathname) : false;
}
