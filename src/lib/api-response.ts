/**
 * 统一 API 响应工具
 * 对齐官网 nihplod.cn 的 { success, error: { code, message } } 格式
 */
import { NextResponse } from "next/server";
import type { ErrorCodeValue } from "@/lib/error-codes";

/**
 * 成功响应
 */
export function apiSuccess<T = unknown>(data?: T, status = 200): NextResponse {
    const body: Record<string, unknown> = { success: true };
    if (data !== undefined) body.data = data;
    return NextResponse.json(body, { status });
}

/**
 * 错误响应（对齐官网格式）
 */
export function apiError(
    code: ErrorCodeValue | string,
    message: string,
    status = 400,
    details?: unknown,
): NextResponse {
    const body: Record<string, unknown> = {
        success: false,
        error: { code, message },
    };
    if (details !== undefined) (body.error as Record<string, unknown>).details = details;
    return NextResponse.json(body, { status });
}
