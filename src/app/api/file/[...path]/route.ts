import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const relativePath = pathSegments.join("/");

        // 目标目录：public/uploads
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        const filePath = path.join(uploadDir, relativePath);

        // 防止目录遍历攻击
        if (!filePath.startsWith(uploadDir)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        if (!existsSync(filePath)) {
            return new NextResponse("Not found", { status: 404 });
        }

        const buffer = await readFile(filePath);

        // 根据扩展名设置 Content-Type
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch {
        return new NextResponse("Internal error", { status: 500 });
    }
}
