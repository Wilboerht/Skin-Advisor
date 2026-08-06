import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ErrorCode } from "@/lib/error-codes";
import { writeFile, mkdir, realpath } from "fs/promises";
import path from "path";
import { enforceStorageLimits } from "@/lib/shared-upload-utils";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * PUT /api/local-upload
 * Local file upload handler (fallback for OSS)
 * 支持游客和登录用户上传，但保留频率限制与文件校验。
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

    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
        return apiError(ErrorCode.VALIDATION_ERROR, "Missing path", 400);
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

    // Validate extension
    const ext = path.extname(requestedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return apiError(ErrorCode.VALIDATION_ERROR, "File type not allowed", 400);
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
