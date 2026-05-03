import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { rateLimit, getClientIP } from "@/lib/ratelimit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Storage guardrails
const MAX_UPLOAD_DIR_FILES = 500;        // Keep at most 500 uploaded files
const MAX_UPLOAD_DIR_SIZE_MB = 512;      // ~512 MB total
const UPLOAD_RETENTION_DAYS = 30;        // Auto-delete files older than 30 days

async function enforceStorageLimits(uploadDir: string): Promise<void> {
    const entries = await readdir(uploadDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile());

    if (files.length === 0) return;

    // Gather file stats with birthtime (fallback to mtime)
    const fileStats = await Promise.all(
        files.map(async (f) => {
            const s = await stat(path.join(uploadDir, f.name));
            return {
                name: f.name,
                size: s.size,
                time: s.birthtimeMs || s.mtimeMs,
            };
        })
    );

    // Sort oldest first
    fileStats.sort((a, b) => a.time - b.time);

    // 1. Enforce retention policy (delete files older than 30 days)
    const cutoff = Date.now() - UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const f of fileStats) {
        if (f.time < cutoff) {
            try {
                await unlink(path.join(uploadDir, f.name));
            } catch {
                // ignore deletion errors
            }
        }
    }

    // Recompute remaining files after retention cleanup
    const remaining = fileStats.filter((f) => f.time >= cutoff);

    // 2. Enforce max file count — delete oldest until under limit
    while (remaining.length > MAX_UPLOAD_DIR_FILES) {
        const oldest = remaining.shift();
        if (!oldest) break;
        try {
            await unlink(path.join(uploadDir, oldest.name));
        } catch {
            // ignore
        }
    }

    // 3. Enforce max total size — delete oldest until under limit
    let totalSize = remaining.reduce((sum, f) => sum + f.size, 0);
    const maxBytes = MAX_UPLOAD_DIR_SIZE_MB * 1024 * 1024;
    while (totalSize > maxBytes && remaining.length > 0) {
        const oldest = remaining.shift();
        if (!oldest) break;
        try {
            await unlink(path.join(uploadDir, oldest.name));
            totalSize -= oldest.size;
        } catch {
            // ignore
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        // 1. Rate limiting per IP
        const ip = getClientIP(request);
        const limit = await rateLimit(`upload-ip-${ip}`, "default", {
            maxRequests: 20,
            windowMs: 60 * 1000,
        });
        if (!limit.success) {
            return NextResponse.json(
                { error: "上传过于频繁，请稍后再试" },
                { status: 429 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "File type not allowed. Only JPEG, PNG, WebP, GIF are supported." },
                { status: 400 }
            );
        }

        // Validate extension
        const originalName = file.name || "upload.png";
        const ext = path.extname(originalName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: "File extension not allowed" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Validate file content via magic numbers
        const magic = buffer.slice(0, 4).toString("hex");
        const isJpeg = magic.startsWith("ffd8");
        const isPng = magic.startsWith("89504e47");
        const isGif = magic.startsWith("47494638");
        const isWebp = buffer.slice(0, 12).toString("hex").includes("57454250");

        if (!isJpeg && !isPng && !isGif && !isWebp) {
            return NextResponse.json({ error: "Invalid file content" }, { status: 400 });
        }

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        // Enforce storage limits before writing
        await enforceStorageLimits(uploadDir);

        // Generate unique filename with timestamp prefix (helps sorting for cleanup)
        const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
        const filePath = path.join(uploadDir, filename);

        // Write file
        await writeFile(filePath, buffer);

        // Return URL
        const url = `/uploads/${filename}`;

        return NextResponse.json({ url });
    } catch (error) {
        console.error("Upload failed:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
