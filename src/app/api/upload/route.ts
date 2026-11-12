import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { handleUpload, createUploadErrorResponse } from "@/lib/upload-handler";

/**
 * 通用上传入口仅保留给管理员/内部运维使用。
 * 普通用户头像、商城资产、人脸照片分别走各自受控的命名空间接口，
 * 避免登录用户把本站当作任意图片托管服务。
 */
export async function POST(request: NextRequest) {
    try {
        const adminSession = await verifyAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return await handleUpload(request);
    } catch (error) {
        return createUploadErrorResponse(error);
    }
}
