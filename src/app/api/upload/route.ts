import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { rateLimit, getClientIP } from "@/lib/ratelimit";
import { enforceStorageLimits } from "@/lib/shared-upload-utils";
import { getSession } from "@/lib/auth";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

export async function POST(request: NextRequest) {
    try {
        // 0. Authentication required
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "请先登录后再上传文件" }, { status: 401 });
        }

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
