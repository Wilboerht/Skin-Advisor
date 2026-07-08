import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyAdminSession } from "@/lib/admin-auth";
import { handleUpload, createUploadErrorResponse } from "@/lib/upload-handler";

export async function POST(request: NextRequest) {
    try {
        // Authentication — 支持普通用户（JWT）和管理员（admin session）两种认证方式
        const userSession = await getSession();
        const adminSession = userSession ? null : await verifyAdminSession();
        if (!userSession && !adminSession) {
            return NextResponse.json({ error: "请先登录后再上传文件" }, { status: 401 });
        }

        return await handleUpload(request);
    } catch (error) {
        return createUploadErrorResponse(error);
    }
}
