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
