import { createHash } from "crypto";
import path from "path";
import { realpath, rm, unlink } from "fs/promises";
import { deleteOSSFiles, deleteOSSPrefix } from "@/lib/ali-oss";
import { isAvatarUploadPath } from "@/lib/upload-paths";

export function getOwnedAvatarObjectName(avatarUrl: string, userId: string): string | null {
    if (!isAvatarUploadPath(avatarUrl)) return null;

    let pathname = avatarUrl;
    if (/^https?:\/\//i.test(avatarUrl)) {
        try {
            pathname = new URL(avatarUrl).pathname;
        } catch {
            return null;
        }
    }

    const objectName = pathname.replace(/^\/+/, "").replace(/^uploads\//, "");
    const ownerHash = createHash("sha256").update(userId).digest("hex").slice(0, 16);
    return objectName.startsWith(`avatars/${ownerHash}/`) ? objectName : null;
}

async function deleteLocalAvatar(objectName: string): Promise<number> {
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    const filePath = path.resolve(uploadRoot, objectName);
    const relative = path.relative(uploadRoot, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Avatar path escapes upload root");
    }

    const [realUploadRoot, realFilePath] = await Promise.all([
        realpath(uploadRoot),
        realpath(filePath).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
        }),
    ]);
    if (!realFilePath) return 0;

    const realRelative = path.relative(realUploadRoot, realFilePath);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        throw new Error("Avatar real path escapes upload root");
    }

    await unlink(realFilePath);
    return 1;
}

export async function deleteUserAvatar(avatarUrl: string | null | undefined, userId: string): Promise<number> {
    if (!avatarUrl) return 0;
    const objectName = getOwnedAvatarObjectName(avatarUrl, userId);
    if (!objectName) return 0;

    if (!/^https?:\/\//i.test(avatarUrl)) {
        return deleteLocalAvatar(objectName);
    }

    const url = new URL(avatarUrl);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
    if (siteUrl && url.origin === new URL(siteUrl).origin) {
        return deleteLocalAvatar(objectName);
    }

    const ossHosts = new Set<string>();
    if (process.env.ALI_OSS_BUCKET && process.env.ALI_OSS_REGION) {
        ossHosts.add(`${process.env.ALI_OSS_BUCKET}.${process.env.ALI_OSS_REGION}.aliyuncs.com`.toLowerCase());
    }
    if (process.env.ALI_OSS_PUBLIC_DOMAIN) {
        const publicDomain = /^https?:\/\//i.test(process.env.ALI_OSS_PUBLIC_DOMAIN)
            ? process.env.ALI_OSS_PUBLIC_DOMAIN
            : `https://${process.env.ALI_OSS_PUBLIC_DOMAIN}`;
        ossHosts.add(new URL(publicDomain).hostname.toLowerCase());
    }
    if (!ossHosts.has(url.hostname.toLowerCase())) return 0;

    await deleteOSSFiles([avatarUrl]);
    return 1;
}


async function deleteLocalFacePrefix(prefix: string): Promise<number> {
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
    const directory = path.resolve(uploadRoot, prefix);
    const relative = path.relative(uploadRoot, directory);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Face upload path escapes upload root");
    }

    const [realUploadRoot, realDirectory] = await Promise.all([
        realpath(uploadRoot),
        realpath(directory).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return null;
            throw error;
        }),
    ]);
    if (!realDirectory) return 0;

    const realRelative = path.relative(realUploadRoot, realDirectory);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        throw new Error("Face upload real path escapes upload root");
    }

    await rm(realDirectory, { recursive: true, force: true });
    return 1;
}

export async function deleteUserFaceUploads(userId: string, legacySessionIds: string[] = []): Promise<number> {
    // 新上传路径按登录用户 ID 哈希（oss/sign 的 rawId = signedInUser.id）；
    // 旧数据可能仍按 sessionId 哈希，调用方传入 legacySessionIds 做兼容清理。
    const ownerHashes = new Set<string>();
    ownerHashes.add(createHash("sha256").update(userId).digest("hex").slice(0, 16));
    for (const sessionId of legacySessionIds) {
        ownerHashes.add(createHash("sha256").update(sessionId).digest("hex").slice(0, 16));
    }

    const prefixes = [...ownerHashes].map((hash) => `guest/${hash}/`);
    let deleted = 0;
    for (let index = 0; index < prefixes.length; index += 10) {
        const counts = await Promise.all(prefixes.slice(index, index + 10).map(async (prefix) => {
            const [localCount, ossCount] = await Promise.all([
                deleteLocalFacePrefix(prefix),
                deleteOSSPrefix(prefix),
            ]);
            return localCount + ossCount;
        }));
        deleted += counts.reduce((sum, count) => sum + count, 0);
    }
    return deleted;
}
