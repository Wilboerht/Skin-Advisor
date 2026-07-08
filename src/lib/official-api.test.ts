import { describe, it, expect, beforeEach } from "vitest";
import {
    signOfficialResponseBody,
    verifyOfficialResponseSignature,
    parseOfficialResponse,
    getOfficialSignatureHeaderName,
} from "./official-api";

describe("official-api signature", () => {
    const secret = "a-very-secret-key-for-testing-official-api-32";

    beforeEach(() => {
        delete process.env.OFFICIAL_API_SECRET;
    });

    it("signs and verifies a response body", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true, data: { user: { id: "u1" } } });
        const sig = signOfficialResponseBody(body);
        expect(sig).not.toBeNull();
        expect(verifyOfficialResponseSignature(body, sig)).toBe(true);
    });

    it("rejects a tampered body", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        const sig = signOfficialResponseBody(body);
        expect(verifyOfficialResponseSignature(body + "x", sig)).toBe(false);
    });

    it("rejects missing signature when secret is configured", () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        expect(verifyOfficialResponseSignature(body, null)).toBe(false);
        expect(verifyOfficialResponseSignature(body, undefined)).toBe(false);
    });

    it("skips verification when secret is not configured", () => {
        const body = JSON.stringify({ success: true });
        expect(verifyOfficialResponseSignature(body, null)).toBe(true);
        expect(verifyOfficialResponseSignature(body, "invalid")).toBe(true);
    });

    it("parses and verifies official JSON response", async () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true, data: { user: { id: "u1" } } });
        const sig = signOfficialResponseBody(body);
        const response = new Response(body, {
            headers: {
                "content-type": "application/json",
                [getOfficialSignatureHeaderName()]: sig!,
            },
        });

        const parsed = await parseOfficialResponse(response);
        expect(parsed).not.toBeNull();
        expect(parsed?.data).toEqual({ success: true, data: { user: { id: "u1" } } });
    });

    it("returns null for invalid signature", async () => {
        process.env.OFFICIAL_API_SECRET = secret;
        const body = JSON.stringify({ success: true });
        const response = new Response(body, {
            headers: {
                "content-type": "application/json",
                [getOfficialSignatureHeaderName()]: "deadbeef",
            },
        });

        const parsed = await parseOfficialResponse(response);
        expect(parsed).toBeNull();
    });
});
