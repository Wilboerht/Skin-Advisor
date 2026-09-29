import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash, createHmac, randomBytes } from "crypto";

/**
 * 入站签名灰度双验签测试（阶段 2）
 *
 * 签名辅助函数是对主站 src/lib/internal-api.ts 出站实现的**独立复刻**
 * （不 import 被测的 generateInternalApiSignature/canonicalizeQuery 参与签名），
 * 保证测的是"主站签的，子站能验"，而非自证。
 */

vi.mock("@/lib/logger", () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    verifyInternalRequest,
    createSignedInternalApiHeaders,
    canonicalizeQuery,
} from "@/lib/internal-api";
import { logger } from "@/lib/logger";

const KEY = "test-key";
const SECRET = "test-secret-must-be-at-least-32-chars!!";

/** 主站 canonicalizeQuery 的独立复刻（码点排序 + encodeURIComponent） */
function masterCanonicalize(search: string): string {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const pairs: [string, string][] = [];
    for (const [k, v] of params.entries()) pairs.push([k, v]);
    pairs.sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : a[1] !== b[1] ? (a[1] < b[1] ? -1 : 1) : 0));
    return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/** 主站出站签名：query 为 undefined 时旧格式，否则新格式 METHOD|path|query|ts|nonce|bodyHash */
function masterSign(
    method: string,
    path: string,
    timestamp: number,
    nonce: string,
    bodyText: string,
    query?: string
): string {
    const bodyHash = createHash("sha256").update(bodyText).digest("hex");
    const payload =
        query === undefined
            ? `${method}|${path}|${timestamp}|${nonce}|${bodyHash}`
            : `${method}|${path}|${query}|${timestamp}|${nonce}|${bodyHash}`;
    return createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** 构造带主站签名头的入站请求（rawQuery 是线上传输的原始查询串） */
function signedRequest(
    method: string,
    path: string,
    rawQuery: string,
    bodyText: string,
    signQuery?: string
): { request: Request; rawBody: string } {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString("hex");
    const signature = masterSign(method, path, timestamp, nonce, bodyText, signQuery);
    const url = `http://localhost${path}${rawQuery ? `?${rawQuery}` : ""}`;
    const request = new Request(url, {
        method,
        headers: {
            "x-internal-api-key": KEY,
            "x-internal-api-timestamp": String(timestamp),
            "x-internal-api-nonce": nonce,
            "x-internal-api-signature": signature,
        },
        ...(bodyText ? { body: bodyText } : {}),
    });
    return { request, rawBody: bodyText };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_API_KEYS", JSON.stringify([{ project: "advisor", key: KEY, secret: SECRET }]));
    vi.stubEnv("INTERNAL_API_REQUIRE_SIGNED_QUERY", "false");
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("canonicalizeQuery 与主站口径一致", () => {
    it("排序 + 重编码结果与主站实现逐字节一致", () => {
        const cases = ["", "userId=u1", "userId=u1&date=2026-09-24", "b=2&a=1", "a=b+c", "a=%26%3D", "flag", "a=1&a=2"];
        for (const c of cases) {
            expect(canonicalizeQuery(c)).toBe(masterCanonicalize(c));
        }
    });

    it("空 query 规范化为空串", () => {
        expect(canonicalizeQuery("")).toBe("");
        expect(canonicalizeQuery("?")).toBe("");
    });
});

describe("verifyInternalRequest 灰度双验签", () => {
    it("新格式（绑定 query）验签通过，记录 query-bound", async () => {
        // 主站签的是 canonical 串；线上传输允许乱序
        const { request, rawBody } = signedRequest(
            "GET",
            "/api/internal/diary",
            "userId=u1&date=2026-09-24",
            "",
            "date=2026-09-24&userId=u1"
        );
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
        expect(result.signatureFormat).toBe("query-bound");
        expect(logger.info).toHaveBeenCalledWith(
            "[InternalApi] 签名校验通过",
            expect.objectContaining({ signatureFormat: "query-bound" })
        );
    });

    it("POST + body：新格式验签通过（bodySha256 参与签名）", async () => {
        const body = JSON.stringify({ date: "2026-09-24", skinState: "good" });
        const { request, rawBody } = signedRequest("POST", "/api/internal/diary", "userId=u1", body, "userId=u1");
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
        expect(result.signatureFormat).toBe("query-bound");
    });

    it("无 query 时新格式（空 query 段）验签通过", async () => {
        const { request, rawBody } = signedRequest("GET", "/api/internal/skin-test-usage", "", "", "");
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
        expect(result.signatureFormat).toBe("query-bound");
    });

    it("默认（灰度期）旧格式签名仍通过，记录 legacy", async () => {
        const { request, rawBody } = signedRequest("GET", "/api/internal/diary", "userId=u1", "", undefined);
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
        expect(result.signatureFormat).toBe("legacy");
    });

    it("INTERNAL_API_REQUIRE_SIGNED_QUERY=true 后旧格式被拒", async () => {
        vi.stubEnv("INTERNAL_API_REQUIRE_SIGNED_QUERY", "true");
        const { request, rawBody } = signedRequest("GET", "/api/internal/diary", "userId=u1", "", undefined);
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("signature_mismatch");
    });

    it("开启开关后新格式不受影响", async () => {
        vi.stubEnv("INTERNAL_API_REQUIRE_SIGNED_QUERY", "true");
        const { request, rawBody } = signedRequest("GET", "/api/internal/diary", "userId=u1", "", "userId=u1");
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
    });

    it("签名后篡改 query 必须验签失败", async () => {
        // 用 userId=u1 的 canonical 签名，但请求 URL 已被改为 userId=u2
        const { request, rawBody } = signedRequest("GET", "/api/internal/diary", "userId=u2", "", "userId=u1");
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("signature_mismatch");
    });

    it("编码差异（+ vs %20、参数乱序）不影响验签", async () => {
        // canonical 为 "a=b%20c&x=1"；线上用 + 表示空格且参数乱序
        const { request, rawBody } = signedRequest("GET", "/api/internal/x", "x=1&a=b+c", "", "a=b%20c&x=1");
        const result = await verifyInternalRequest(request, rawBody);
        expect(result.ok).toBe(true);
        expect(result.signatureFormat).toBe("query-bound");
    });
});

/** 主站入站 verifyInternalApiSignature 的独立复刻：新格式优先，旧格式兜底 */
function masterInboundVerify(
    signature: string,
    method: string,
    path: string,
    rawSearch: string,
    timestamp: number,
    nonce: string,
    bodyText: string
): "query-bound" | "legacy" | null {
    const bodyHash = createHash("sha256").update(bodyText).digest("hex");
    const canonical = masterCanonicalize(rawSearch);
    const h = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("hex");
    if (h(`${method}|${path}|${canonical}|${timestamp}|${nonce}|${bodyHash}`) === signature) return "query-bound";
    if (h(`${method}|${path}|${timestamp}|${nonce}|${bodyHash}`) === signature) return "legacy";
    return null;
}

describe("createSignedInternalApiHeaders 出站新格式签名", () => {
    function parseSigned(result: Awaited<ReturnType<typeof createSignedInternalApiHeaders>>) {
        expect(result).not.toBeNull();
        const headers = result!.headers;
        return {
            signature: headers["X-Internal-API-Signature"],
            timestamp: Number(headers["X-Internal-API-Timestamp"]),
            nonce: headers["X-Internal-API-Nonce"],
        };
    }

    it("带 query 的 GET（points/balance 场景）：主站入站按新格式验签通过", async () => {
        const signed = await createSignedInternalApiHeaders(
            "advisor", "GET", "/api/v1/internal/points/balance", "",
            { query: "phone=13800138000" }
        );
        const { signature, timestamp, nonce } = parseSigned(signed);
        // 主站入站 canonicalize 的是实际请求 URL 的 search
        expect(
            masterInboundVerify(signature, "GET", "/api/v1/internal/points/balance", "?phone=13800138000", timestamp, nonce, "")
        ).toBe("query-bound");
    });

    it("无 query 的 POST（points/grant 场景）：新格式（空 query 段）验签通过", async () => {
        const body = JSON.stringify({ userId: "u1", points: 2 });
        const signed = await createSignedInternalApiHeaders("advisor", "POST", "/api/v1/internal/points/grant", body);
        const { signature, timestamp, nonce } = parseSigned(signed);
        expect(
            masterInboundVerify(signature, "POST", "/api/v1/internal/points/grant", "", timestamp, nonce, body)
        ).toBe("query-bound");
    });

    it("线上 query 与签名 query 编码/顺序不同但 canonical 相同：仍通过", async () => {
        const signed = await createSignedInternalApiHeaders(
            "advisor", "GET", "/api/v1/internal/x", "",
            { query: "b=2&a=b+c" }
        );
        const { signature, timestamp, nonce } = parseSigned(signed);
        expect(
            masterInboundVerify(signature, "GET", "/api/v1/internal/x", "?a=b%20c&b=2", timestamp, nonce, "")
        ).toBe("query-bound");
    });

    it("出站不再产生旧格式签名（query 被篡改时主站必拒）", async () => {
        const signed = await createSignedInternalApiHeaders(
            "advisor", "GET", "/api/v1/internal/points/balance", "",
            { query: "phone=13800138000" }
        );
        const { signature, timestamp, nonce } = parseSigned(signed);
        // 旧格式 payload 不匹配
        expect(
            masterInboundVerify(signature, "GET", "/api/v1/internal/points/balance", "?phone=13800138000", timestamp, nonce, "")
        ).not.toBe("legacy");
        // 篡改 query（换手机号）后主站验签失败
        expect(
            masterInboundVerify(signature, "GET", "/api/v1/internal/points/balance", "?phone=13911112222", timestamp, nonce, "")
        ).toBeNull();
    });
});
