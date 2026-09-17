import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { writeFile, mkdir, realpath } from "fs/promises";
import path from "path";
import { enforceStorageLimits } from "@/lib/shared-upload-utils";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { getSessionUser } from "@/lib/sso-auth";
import { isManagedUploadPath } from "@/lib/upload-paths";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * PUT /api/local-upload
 * Local file upload handler (fallback for OSS)
 * 需登录：上传仅发生在扫脸/分析流程（这些流程本就要求登录）。
 */
export async function PUT(request: NextRequest) {
    // Rate limiting per IP
    const ip = getClientIP(request);
    const limit = await rateLimit(`local-upload-${ip}`, "default", {
        maxRequests: 20,
        windowMs: 60 * 1000,
    });
    if (!limit.success) {
        return apiError(ErrorCode.RATE_LIMITED, "上传过于频繁，请稍后再试", 429);
    }

    // 归属校验：未登录不允许写入磁盘（防止匿名内容污染/文件覆盖）
    const user = await getSessionUser(request);
    if (!user) {
        return apiError(ErrorCode.UNAUTHORIZED, "请先登录后再上传", 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
        return apiError(ErrorCode.VALIDATION_ERROR, "Missing path", 400);
    }

    // 严格路径白名单（先于文件系统解析，拒绝一切非签名生成规则的路径）
    if (filePath.includes("\\") || !isManagedUploadPath(filePath)) {
        return apiError(ErrorCode.VALIDATION_ERROR, "Invalid upload path", 400);
    }

    // Security: normalize and whitelist the resolved path
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    const requestedPath = path.normalize(filePath);

    // Reject any path that tries to escape the upload directory
    if (path.isAbsolute(requestedPath) || requestedPath.startsWith("..") || requestedPath.includes(".." + path.sep)) {
        return apiError(ErrorCode.VALIDATION_ERROR, "Invalid path", 400);
    }

    const fullPath = path.resolve(uploadRoot, requestedPath);
    if (!fullPath.startsWith(uploadRoot + path.sep) && fullPath !== uploadRoot) {
        return apiError(ErrorCode.FORBIDDEN, "Path traversal detected", 403);
    }

    try {
        // Check Content-Length before reading body to prevent memory exhaustion
        const contentLength = request.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
            return apiError(ErrorCode.VALIDATION_ERROR, `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
        }

        // Read the file content
        const buffer = Buffer.from(await request.arrayBuffer());

        // Validate file size
        if (buffer.length > MAX_FILE_SIZE) {
            return apiError(ErrorCode.VALIDATION_ERROR, `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
        }

        // Validate MIME type via file magic numbers (simple check)
        const magic = buffer.slice(0, 4).toString("hex");
        const isJpeg = magic.startsWith("ffd8");
        const isPng = magic.startsWith("89504e47");
        const isGif = magic.startsWith("47494638");
        const isWebp = buffer.slice(0, 12).toString("hex").includes("57454250"); // WEBP

        if (!isJpeg && !isPng && !isGif && !isWebp) {
            return apiError(ErrorCode.VALIDATION_ERROR, "Invalid file content", 400);
        }

        const dir = path.dirname(fullPath);

        // Ensure directory exists
        await mkdir(dir, { recursive: true });

        // Resolve symlinks to prevent writing outside the upload root
        const realUploadRoot = await realpath(uploadRoot);
        const realDir = await realpath(dir);
        const realFullPath = path.join(realDir, path.basename(fullPath));
        if (
            !realFullPath.startsWith(realUploadRoot + path.sep) &&
            realFullPath !== realUploadRoot
        ) {
            return apiError(ErrorCode.FORBIDDEN, "Path traversal detected", 403);
        }

        // Enforce storage limits before writing
        await enforceStorageLimits(uploadRoot);

        // Write file
        await writeFile(realFullPath, buffer);

        return apiSuccess();
    } catch (error) {
        logger.error("Local upload failed:", error);
        return apiError(ErrorCode.INTERNAL_ERROR, "Upload failed", 500);
    }
}
