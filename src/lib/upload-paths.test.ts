import { describe, it, expect } from "vitest";
import { isManagedUploadPath, isAvatarUploadPath } from "./upload-paths";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const HASH = "0123456789abcdef";

describe("upload-path guards", () => {
    it("recognizes guest face uploads only", () => {
        expect(isManagedUploadPath(`guest/${HASH}/2026-10-19/${UUID}.jpg`)).toBe(true);
        expect(isManagedUploadPath(`/uploads/guest/${HASH}/2026-10-19/${UUID}.webp`)).toBe(true);
        expect(isManagedUploadPath(`https://cdn.example.com/guest/${HASH}/2026-10-19/${UUID}.png`)).toBe(true);
    });

    it("does not treat avatars as face uploads (face cleanup cannot delete avatars)", () => {
        expect(isManagedUploadPath(`avatars/${HASH}/2026-10-19/${UUID}.jpg`)).toBe(false);
        expect(isAvatarUploadPath(`avatars/${HASH}/2026-10-19/${UUID}.jpg`)).toBe(true);
        expect(isAvatarUploadPath(`/uploads/avatars/${HASH}/2026-10-19/${UUID}.webp`)).toBe(true);
    });

    it("rejects arbitrary or traversal paths", () => {
        expect(isManagedUploadPath("products/foo.jpg")).toBe(false);
        expect(isManagedUploadPath("guest/../../etc/passwd")).toBe(false);
        expect(isAvatarUploadPath("avatars/../../foo.jpg")).toBe(false);
        expect(isAvatarUploadPath("https://evil.com/avatars/x.jpg")).toBe(false);
    });
});
