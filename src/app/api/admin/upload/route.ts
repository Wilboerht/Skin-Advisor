import { NextRequest } from "next/server";
import { requireRole } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { handleUpload, createUploadErrorResponse } from "@/lib/upload-handler";

// POST /api/admin/upload
// Admin-only upload endpoint. Uses the same storage logic as /api/upload but is
// protected by the admin session + same-origin checks in middleware.
// 管理端上传的是展品图等永久资产，存入 products/ 子目录，豁免 30 天清理策略。
export const POST = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (request: NextRequest) => {
    try {
        return await handleUpload(request, "products");
    } catch (error) {
        return createUploadErrorResponse(error);
    }
});
