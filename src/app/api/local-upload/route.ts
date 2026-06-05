import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { enforceStorageLimits } from "@/lib/shared-upload-utils";
import { getSession } from "@/lib/auth";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * PUT /api/local-upload
 * Local file upload handler (fallback for OSS)
 */
export async function PUT(request: NextRequest) {
    // Authentication required
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "请先登录后再上传文件" }, { status: 401 });
    }

    // Rate limiting per IP
    const ip = getClientIP(request);
    const limit = await rateLimit(`local-upload-${ip}`, "default", {
        maxRequests: 20,
        windowMs: 60 * 1000,
    });
    if (!limit.success) {
        return NextResponse.json(
            { error: "上传过于频繁，请稍后再试" },
            { status: 429 }
        );
    }

    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
        return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // Security: normalize and whitelist the resolved path
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    const requestedPath = path.normalize(filePath);

    // Reject any path that tries to escape the upload directory
    if (path.isAbsolute(requestedPath) || requestedPath.startsWith("..") || requestedPath.includes(".." + path.sep)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullPath = path.resolve(uploadRoot, requestedPath);
    if (!fullPath.startsWith(uploadRoot + path.sep) && fullPath !== uploadRoot) {
        return NextResponse.json({ error: "Path traversal detected" }, { status: 403 });
    }

    // Validate extension
    const ext = path.extname(requestedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    try {
        // 检查是否在 Vercel 无服务器环境（不支持本地文件系统持久化）
        if (process.env.VERCEL) {
            console.warn("本地上传不支持 Vercel 无服务器环境。请配置阿里云 OSS。");
            return NextResponse.json(
                { error: "云环境不支持本地存储，请配置阿里云 OSS" },
                { status: 503 }
            );
        }

        // Read the file content
        const buffer = Buffer.from(await request.arrayBuffer());

        // Validate file size
        if (buffer.length > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        // Validate MIME type via file magic numbers (simple check)
        const magic = buffer.slice(0, 4).toString("hex");
        const isJpeg = magic.startsWith("ffd8");
        const isPng = magic.startsWith("89504e47");
        const isGif = magic.startsWith("47494638");
        const isWebp = buffer.slice(0, 12).toString("hex").includes("57454250"); // WEBP

        if (!isJpeg && !isPng && !isGif && !isWebp) {
            return NextResponse.json({ error: "Invalid file content" }, { status: 400 });
        }

        const dir = path.dirname(fullPath);

        // Ensure directory exists
        await mkdir(dir, { recursive: true });

        // Enforce storage limits before writing
        await enforceStorageLimits(uploadRoot);

        // Write file
        await writeFile(fullPath, buffer);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Local upload failed:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
