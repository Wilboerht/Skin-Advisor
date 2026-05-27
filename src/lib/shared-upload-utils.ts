import { readdir, stat, unlink } from "fs/promises";
import path from "path";

// Storage guardrails
const MAX_UPLOAD_DIR_FILES = 500;        // Keep at most 500 uploaded files
const MAX_UPLOAD_DIR_SIZE_MB = 512;      // ~512 MB total
const UPLOAD_RETENTION_DAYS = 30;        // Auto-delete files older than 30 days

/**
 * Enforce storage limits on an upload directory.
 * 1. Deletes files older than UPLOAD_RETENTION_DAYS.
 * 2. Deletes oldest files if total count exceeds MAX_UPLOAD_DIR_FILES.
 * 3. Deletes oldest files if total size exceeds MAX_UPLOAD_DIR_SIZE_MB.
 *
 * Errors during individual file deletions are silently ignored to prevent
 * a single unreadable file from blocking all uploads.
 */
export async function enforceStorageLimits(uploadDir: string): Promise<void> {
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

    // 2. Enforce max file count (keep newest)
    const remaining = fileStats.filter((f) => f.time >= cutoff);
    while (remaining.length > MAX_UPLOAD_DIR_FILES) {
        const oldest = remaining.shift();
        if (!oldest) break;
        try {
            await unlink(path.join(uploadDir, oldest.name));
        } catch {
            // ignore
        }
    }

    // 3. Enforce max total size (remove oldest until under limit)
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
