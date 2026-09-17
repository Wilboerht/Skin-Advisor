/**
 * 服务端签发上传对象的命名规则（唯一事实源）
 *
 * 由 `/api/oss/sign` 生成：`guest/<16位标识哈希>/<YYYY-MM-DD>/<uuid>.<ext>`
 *
 * 用途：
 * - `local-upload` 只接受符合该规则的路径（防止覆盖 products/ 等永久资产或任意已知文件）；
 * - 文件清理只允许删除符合该规则的对象（防止把用户传入的 URL 当删除指令）。
 */

const MANAGED_UPLOAD_RE =
    /^guest\/[0-9a-f]{16}\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/i;

/**
 * 判断路径/URL 是否属于服务端签发的上传对象。
 * 支持入参：`guest/...`、`uploads/guest/...`、`/uploads/guest/...`、`https://host/guest/...`
 */
export function isManagedUploadPath(pathOrUrl: string | null | undefined): boolean {
    if (!pathOrUrl) return false;
    let pathname = pathOrUrl;
    if (/^https?:\/\//i.test(pathOrUrl)) {
        try {
            pathname = new URL(pathOrUrl).pathname;
        } catch {
            return false;
        }
    }
    pathname = pathname.replace(/^\/+/, "").replace(/^uploads\//, "");
    return MANAGED_UPLOAD_RE.test(pathname);
}
