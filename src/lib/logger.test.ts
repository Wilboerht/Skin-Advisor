import { describe, expect, it } from "vitest";
import { redactLogText } from "./logger";

describe("logger redaction", () => {
    it("redacts phone, IP, bearer, JWT and query secrets in messages", () => {
        const text = redactLogText(
            "user=13812345678 ip=203.0.113.9 Authorization: Bearer abc.def.ghi token=secret-value jwt=eyJabcdefgh.abcdefgh.abcdefgh"
        );
        expect(text).not.toContain("13812345678");
        expect(text).not.toContain("203.0.113.9");
        expect(text).not.toContain("abc.def.ghi");
        expect(text).not.toContain("secret-value");
        expect(text).toContain("[REDACTED_PHONE]");
        expect(text).toContain("[REDACTED_IP]");
    });
});
