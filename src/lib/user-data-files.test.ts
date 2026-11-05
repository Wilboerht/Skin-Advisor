import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { getOwnedAvatarObjectName } from "./user-data-files";

const userId = "user-1";
const ownerHash = createHash("sha256").update(userId).digest("hex").slice(0, 16);
const objectName = `avatars/${ownerHash}/2026-11-05/123e4567-e89b-42d3-a456-426614174000.jpg`;

describe("getOwnedAvatarObjectName", () => {
    it("接受当前用户的本地和 OSS 头像路径", () => {
        expect(getOwnedAvatarObjectName(`/uploads/${objectName}`, userId)).toBe(objectName);
        expect(getOwnedAvatarObjectName(`https://cdn.example.com/${objectName}`, userId)).toBe(objectName);
    });

    it("拒绝其他用户目录和非头像对象", () => {
        const otherObject = objectName.replace(ownerHash, "0000000000000000");
        expect(getOwnedAvatarObjectName(`/uploads/${otherObject}`, userId)).toBeNull();
        expect(getOwnedAvatarObjectName("/uploads/guest/photo.jpg", userId)).toBeNull();
        expect(getOwnedAvatarObjectName("not-a-url", userId)).toBeNull();
    });
});
