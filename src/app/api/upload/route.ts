import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";


export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const originalName = file.name || "upload.png";
        const ext = path.extname(originalName) || ".png"; // Default to .png if no extension
        const filename = `${crypto.randomUUID()}${ext}`;
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
