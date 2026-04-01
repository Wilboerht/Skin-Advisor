import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Security check: prevent directory traversal
    if (filePath.includes("..")) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
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

        // Define the target path in public/uploads
        // Note: In development, writing to public might trigger reload
        // In production container, persistency depends on volume mounting
        const fullPath = path.join(process.cwd(), "public", "uploads", filePath);
        const dir = path.dirname(fullPath);

        // Ensure directory exists
        await mkdir(dir, { recursive: true });

        // Write file
        await writeFile(fullPath, buffer);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Local upload failed:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
