/**
 * 统一 API 响应工具
 * 对齐官网 nihplod.cn 的 { success, error: { code, message } } 格式
 */
import { NextResponse } from "next/server";
import { ErrorCode, type ErrorCodeValue } from "@/lib/error-codes";

/** 子站本地账号被管理员禁用（与主站账号状态无关） */
export const ACCOUNT_DISABLED_MESSAGE = "账号已被限制使用测肤功能，请联系客服";

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

/**
 * 子站账号被禁用响应：403 ACCOUNT_DISABLED。
 * 与未登录 401 区分，客户端（小程序/官网）可提示“功能被限制”而不是反复登录。
 */
export function accountDisabledResponse(): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: { code: ErrorCode.ACCOUNT_DISABLED, message: ACCOUNT_DISABLED_MESSAGE },
            requireLogin: false,
            accountDisabled: true,
        },
        { status: 403 }
    );
}
