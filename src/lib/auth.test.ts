import { describe, it, expect, beforeAll } from "vitest";
import {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken,
    verifyTokenDetailed,
} from "./auth";

describe("auth", () => {
    beforeAll(() => {
        process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters-long";
    });

    describe("password hashing", () => {
        it("hashes and verifies a password", async () => {
            const hashed = await hashPassword("Password123");
            expect(hashed).not.toBe("Password123");
            expect(await verifyPassword("Password123", hashed)).toBe(true);
            expect(await verifyPassword("WrongPassword", hashed)).toBe(false);
        });
    });

    describe("JWT signing", () => {
        it("signs and verifies a token", async () => {
            const token = await signToken({ sub: "user_123", role: "user" }, "1h");
            const payload = await verifyToken(token);
            expect(payload).not.toBeNull();
            expect(payload?.sub).toBe("user_123");
            expect(payload?.role).toBe("user");
        });

        it("rejects an invalid token", async () => {
            const result = await verifyTokenDetailed("not-a-real-token");
            expect(result.payload).toBeNull();
            expect(result.error).toBe("malformed");
        });

        it("rejects a tampered token", async () => {
            const token = await signToken({ sub: "user_123" }, "1h");
            const tampered = token.slice(0, -5) + "XXXXX";
            const result = await verifyTokenDetailed(tampered);
            expect(result.payload).toBeNull();
            expect(result.error).toBe("invalid_signature");
        });
    });
});
