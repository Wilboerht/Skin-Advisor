import { adminFetch } from "@/lib/admin-fetch";

export interface AdminExportDownloadResult {
    filename: string;
    truncated: boolean;
    rowLimit: string | null;
}

/**
 * 下载管理端 CSV 导出。
 * 统一处理错误、文件名、截断标记，避免直接 window.open 时 403/500 显示 JSON。
 */
export async function downloadAdminExport(
    type: string,
    params?: Record<string, string>
): Promise<AdminExportDownloadResult> {
    const search = new URLSearchParams({ type, ...(params ?? {}) });
    const response = await adminFetch(`/api/admin/export?${search.toString()}`);

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
        throw new Error(payload?.error || "导出失败");
    }

    const truncated = response.headers.get("X-Export-Truncated") === "true";
    const rowLimit = response.headers.get("X-Export-Row-Limit");
    const disposition = response.headers.get("Content-Disposition") || "";
    const filename =
        disposition.match(/filename="([^"]+)"/i)?.[1] ||
        `${type}-${new Date().toISOString().slice(0, 10)}.csv`;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { filename, truncated, rowLimit };
}
