/**
 * 测肤证书下载的纯函数工具（客户端/测试共用）
 */

/** 下载文件名清洗：去掉文件系统非法字符，空结果兜底"用户" */
export function sanitizeFilename(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "用户";
}
