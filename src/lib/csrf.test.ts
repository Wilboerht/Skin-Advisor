import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { generateCsrfToken, verifyCsrfToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf";
import { signToken, AUTH_COOKIE_NAME } from "./auth";

describe("csrf", () => {
    beforeAll(() => {
        process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters-long";
    });

    it("generates unique tokens", () => {
        const a = generateCsrfToken();
        const b = generateCsrfToken();
        expect(a).not.toBe(b);
        expect(a.length).toBe(32);
    });

    it("passes when cookie, header and JWT claim all match", async () => {
        const csrf = generateCsrfToken();
        const token = await signToken({ sub: "user_123", csrf }, "1h");

        const request = new NextRequest("http://localhost/api/user/profile", {
            method: "PUT",
            headers: {
                cookie: `${AUTH_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrf}`,
                [CSRF_HEADER_NAME]: csrf,
            },
        });

        expect(await verifyCsrfToken(request)).toEqual({ valid: true, reason: "ok" });
    });

    it("fails when header does not match cookie", async () => {
        const csrf = generateCsrfToken();
        const token = await signToken({ sub: "user_123", csrf }, "1h");

        const request = new NextRequest("http://localhost/api/user/profile", {
            method: "PUT",
            headers: {
                cookie: `${AUTH_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrf}`,
                [CSRF_HEADER_NAME]: "wrong-token",
            },
        });

        expect(await verifyCsrfToken(request)).toEqual({ valid: false, reason: "cookie_mismatch" });
    });

    it("allows GET requests without token", async () => {
        const request = new NextRequest("http://localhost/api/user/profile", {
            method: "GET",
        });

        expect(await verifyCsrfToken(request)).toEqual({ valid: true, reason: "ok" });
    });
});
