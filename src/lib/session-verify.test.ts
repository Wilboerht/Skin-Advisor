import { describe, it, expect, beforeAll } from "vitest";
import {
    createSignedSession,
    verifySessionSignature,
} from "./session-verify";

describe("session-verify", () => {
    beforeAll(() => {
        process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-32-chars-long";
    });

    it("creates and verifies a valid session", async () => {
        const signed = await createSignedSession({
            adminId: "admin_123",
            username: "admin",
            role: "super_admin",
        });

        const parsed = await verifySessionSignature(signed);
        expect(parsed).not.toBeNull();
        expect(parsed?.adminId).toBe("admin_123");
        expect(parsed?.username).toBe("admin");
        expect(parsed?.role).toBe("super_admin");
    });

    it("rejects a tampered session", async () => {
        const signed = await createSignedSession({
            adminId: "admin_123",
            username: "admin",
            role: "super_admin",
        });

        const tampered = signed.replace("admin_123", "admin_999");
        const parsed = await verifySessionSignature(tampered);
        expect(parsed).toBeNull();
    });

    it("rejects an expired session", async () => {
        // 构造一个已过期载荷：手动创建并签名一个 exp 为 1 的 token
        const { createSignedSession } = await import("./session-verify");
        const signed = await createSignedSession({
            adminId: "admin_123",
            username: "admin",
            role: "super_admin",
        });

        const [dataPart] = signed.split(".");
        const payload = JSON.parse(dataPart);
        payload.exp = 1;

        const { signSessionData } = await import("./session-verify");
        const newSig = await signSessionData(JSON.stringify(payload));
        const expiredSigned = `${JSON.stringify(payload)}.${newSig}`;

        const parsed = await verifySessionSignature(expiredSigned);
        expect(parsed).toBeNull();
    });
});
