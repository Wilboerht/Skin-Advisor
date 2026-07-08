import { NextRequest } from "next/server";
import { requireRole } from "@/lib/admin-auth";
import { AdminRole } from "@/lib/permissions";
import { handleUpload, createUploadErrorResponse } from "@/lib/upload-handler";

// POST /api/admin/upload
// Admin-only upload endpoint. Uses the same storage logic as /api/upload but is
// protected by the admin session + same-origin checks in middleware.
export const POST = requireRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)(async (request: NextRequest) => {
    try {
        return await handleUpload(request);
    } catch (error) {
        return createUploadErrorResponse(error);
    }
});
