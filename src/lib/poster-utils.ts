/**
 * 测肤证书海报的纯函数工具（客户端/测试共用）
 *
 * 从 ResultClient / SharePoster / ShareCardPage 抽取，避免同一规则多份实现漂移，
 * 并为空白检测、文件名清洗、证书日期/编号格式化提供单测覆盖。
 */

/**
 * 判断画布像素数据是否为空图。
 *
 * 两种空白形态都要拦截：
 * 1. 全透明（alpha 全 0）——截图失败的典型产物；
 * 2. 纯色不透明图（如纯白）——alpha 全 255，仅查 alpha 会漏检。
 * 以首个不透明像素为基准色，出现明显色差即视为有内容；整幅无任何色差即空白。
 */
export function isPixelDataBlank(data: Uint8ClampedArray): boolean {
    let baseR = -1;
    let baseG = -1;
    let baseB = -1;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if (baseR < 0) {
            baseR = data[i];
            baseG = data[i + 1];
            baseB = data[i + 2];
            continue;
        }
        const diff =
            Math.abs(data[i] - baseR) +
            Math.abs(data[i + 1] - baseG) +
            Math.abs(data[i + 2] - baseB);
        if (diff > 12) return false;
    }
    return true;
}

/** 下载文件名清洗：去掉文件系统非法字符，空结果兜底"用户" */
export function sanitizeFilename(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "用户";
}

/** 测肤日期（ISO）格式化为 YYYY.MM.DD；缺失/非法返回 null（不展示） */
export function formatCertDate(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 会话 ID 截取后 6 位作为证书编号；不足 4 位返回 null（不展示） */
export function formatCertId(sessionId?: string): string | null {
    if (!sessionId) return null;
    const last6 = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
    return last6.length >= 4 ? last6.toUpperCase() : null;
}
