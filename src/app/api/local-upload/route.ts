import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Storage guardrails (same as /api/upload)
const MAX_UPLOAD_DIR_FILES = 500;
const MAX_UPLOAD_DIR_SIZE_MB = 512;
const UPLOAD_RETENTION_DAYS = 30;

async function enforceStorageLimits(uploadDir: string): Promise<void> {
    const entries = await readdir(uploadDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile());
    if (files.length === 0) return;

    const fileStats = await Promise.all(
        files.map(async (f) => {
            const s = await stat(path.join(uploadDir, f.name));
            return { name: f.name, size: s.size, time: s.birthtimeMs || s.mtimeMs };
        })
    );
    fileStats.sort((a, b) => a.time - b.time);

    const cutoff = Date.now() - UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const f of fileStats) {
        if (f.time < cutoff) {
            try { await unlink(path.join(uploadDir, f.name)); } catch { /* ignore */ }
        }
    }

    const remaining = fileStats.filter((f) => f.time >= cutoff);
    while (remaining.length > MAX_UPLOAD_DIR_FILES) {
        const oldest = remaining.shift();
        if (!oldest) break;
        try { await unlink(path.join(uploadDir, oldest.name)); } catch { /* ignore */ }
    }

    let totalSize = remaining.reduce((sum, f) => sum + f.size, 0);
    const maxBytes = MAX_UPLOAD_DIR_SIZE_MB * 1024 * 1024;
    while (totalSize > maxBytes && remaining.length > 0) {
        const oldest = remaining.shift();
        if (!oldest) break;
        try { await unlink(path.join(uploadDir, oldest.name)); totalSize -= oldest.size; } catch { /* ignore */ }
    }
}

/**
 * PUT /api/local-upload
 * Local file upload handler (fallback for OSS)
 */
export async function PUT(request: NextRequest) {
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
            console.warn("本地上传不支持 Vercel 无服务器环境。请配置 Supabase 或阿里云 OSS。");
            return NextResponse.json(
                { error: "云环境不支持本地存储，请配置云存储服务（Supabase/OSS）" },
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
