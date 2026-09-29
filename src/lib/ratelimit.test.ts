import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * getClientIP 的 X-Forwarded-For 伪造加固测试
 *
 * 未配置 TRUSTED_PROXY_HOPS 时，X-Real-IP / X-Forwarded-For 均可被客户端
 * 任意伪造，必须不信任（退回 "unknown"），否则 IP 维度限流可被绕过。
 * TRUSTED_PROXY_HOPS 在模块加载时读取，因此每个用例独立 stubEnv + 重新导入。
 */

function req(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/x", { headers });
}

async function importRatelimit() {
    vi.resetModules();
    return import("@/lib/ratelimit");
}

describe("getClientIP", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("未配置 TRUSTED_PROXY_HOPS：伪造 XFF/X-Real-IP 不影响限流标识", async () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "");
        const { getClientIP } = await importRatelimit();

        const a = getClientIP(req({ "x-forwarded-for": "1.1.1.1" }));
        const b = getClientIP(req({ "x-forwarded-for": "9.9.9.9, 8.8.8.8", "x-real-ip": "7.7.7.7" }));

        expect(a).toBe("unknown");
        expect(b).toBe("unknown");
        // 伪造不同的头得到相同标识 → 攻击者共享同一限流桶，无法绕过
        expect(a).toBe(b);
    });

    it("TRUSTED_PROXY_HOPS=1：优先 X-Real-IP，其次从 XFF 右起排除一跳", async () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
        const { getClientIP } = await importRatelimit();

        expect(getClientIP(req({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.1.1.1" }))).toBe("5.6.7.8");
        // XFF = "客户端, 边缘代理(最右)"，排除 1 跳后取客户端
        expect(getClientIP(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
        // 伪造者在前端注入的左侧条目不影响结果（hop 数不足时兜底最左）
        expect(getClientIP(req({ "x-forwarded-for": "6.6.6.6, 9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
        expect(getClientIP(req({}))).toBe("unknown");
    });

    it("保留 loopback 归一化与空白修剪", async () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
        const { getClientIP } = await importRatelimit();

        expect(getClientIP(req({ "x-real-ip": " 127.0.0.1 " }))).toBe("local_dev_loopback");
        expect(getClientIP(req({ "x-forwarded-for": "::1, 10.0.0.1" }))).toBe("local_dev_loopback");
    });
});
