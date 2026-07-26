import { NextRequest, NextResponse } from "next/server";
import { handleUpload, createUploadErrorResponse } from "@/lib/upload-handler";
import { getSession } from "@/lib/auth";

/**
 * POST /api/upload/community
 *
 * 社区照片上传（前后对比照）。
 * 需登录，使用公共 upload handler 的校验逻辑。
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json(
        { error: "请先登录后再上传照片" },
        { status: 401 }
      );
    }

    return await handleUpload(request);
  } catch (error) {
    return createUploadErrorResponse(error);
  }
}
