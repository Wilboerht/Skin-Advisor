/**
 * 【临时验证脚本】profile-webhook 接收端点 —— 验证通过后删除
 *
 * 本地生成 RS256 密钥对 + 起临时 HTTP 服务暴露 JWKS，
 * 直接调用 route handler 验证：
 *   (a) 合法 token 更新 User 字段成功
 *   (b) 错误 aud / 错误 type / 过期 token / HS256 token 返回 401，缺 event_token 返回 400
 *   (c) 无 membership 字段时只更新 profile，不动会员字段
 *
 * 运行：npx -y tsx scripts/test-profile-webhook.ts
 */
import http from "node:http";
import { config as loadEnv } from "dotenv";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

loadEnv({ path: ".env.local" }); // 读取 DATABASE_URL（值不打印）

if (!process.env.DATABASE_URL) {
    console.error("FAIL: DATABASE_URL 未配置（.env.local）");
    process.exit(1);
}

const JWKS_PORT = 18321;
const STUB_BASE = `http://127.0.0.1:${JWKS_PORT}`;
// 必须在动态 import route 之前设置：route/sso-auth 在模块加载时读取这些变量
process.env.NEXT_PUBLIC_SSO_BASE_URL = STUB_BASE;
process.env.NEXT_PUBLIC_SSO_CLIENT_ID = "webhook-test-client";

const CLIENT_ID = "webhook-test-client";
const KID = "logout-test-key";
const USER_ID = "webhook-test-user-001";
const GHOST_ID = "webhook-test-ghost-000";

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
    if (cond) {
        passed++;
        console.log(`  PASS ${label}`);
    } else {
        failed++;
        console.error(`  FAIL ${label}`, detail ?? "");
    }
}

async function main() {
    // ---------- 1. RS256 密钥对 + JWKS stub ----------
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = "RS256";
    jwk.use = "sig";

    const server = http.createServer((req, res) => {
        if (req.url === "/api/oauth/jwks") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ keys: [jwk] }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    await new Promise<void>((resolve) => server.listen(JWKS_PORT, "127.0.0.1", resolve));
    console.log(`JWKS stub listening on ${STUB_BASE}/api/oauth/jwks`);

    // ---------- 2. 动态 import（env 就绪后） ----------
    const { POST } = await import("../src/app/api/auth/profile-webhook/route");
    const prisma = (await import("../src/lib/prisma")).default;

    // ---------- 3. 准备测试用户 ----------
    await prisma.user.deleteMany({ where: { id: { in: [USER_ID, GHOST_ID] } } });
    await prisma.user.create({
        data: {
            id: USER_ID,
            name: "旧昵称",
            membershipLevel: "REGULAR",
            totalSpent: 0,
            role: "user",
            tokenVersion: 0,
        },
    });

    const signEvent = (claims: Record<string, unknown>, opts?: { exp?: string; aud?: string }) =>
        new SignJWT({
            type: "profile_event",
            events: { [`${STUB_BASE}/event/profile_update`]: {} },
            ...claims,
        })
            .setProtectedHeader({ alg: "RS256", kid: KID })
            .setIssuer(STUB_BASE)
            .setAudience(opts?.aud ?? CLIENT_ID)
            .setSubject(USER_ID)
            .setJti(crypto.randomUUID())
            .setIssuedAt()
            .setExpirationTime(opts?.exp ?? "5m")
            .sign(privateKey);

    const callRoute = async (body: unknown) => {
        const { NextRequest } = await import("next/server");
        const req = new NextRequest(`${STUB_BASE}/api/auth/profile-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return POST(req);
    };

    try {
        // ---------- (a) 合法 token：membership + profile 全量更新 ----------
        console.log("\n(a) 合法 token 更新 User：");
        const validToken = await signEvent({
            profile: { nickname: "Webhook新昵称", avatar: "/uploads/avatars/x.png", birthday: null },
            membership: { level: "SILVER", totalSpent: 2500.7 },
        });
        let res = await callRoute({ event_token: validToken });
        assert(res.status === 200, "合法 token 返回 200", res.status);
        let user = await prisma.user.findUnique({ where: { id: USER_ID } });
        assert(user?.name === "Webhook新昵称", "name 已更新", user?.name);
        assert(
            user?.avatarUrl === `${STUB_BASE}/uploads/avatars/x.png`,
            "相对路径 avatar 已补全为主站绝对地址",
            user?.avatarUrl
        );
        assert(user?.membershipLevel === "SILVER", "membershipLevel 已更新", user?.membershipLevel);
        assert(user?.totalSpent === 2500, "totalSpent 已收敛为 2500（小数截断）", user?.totalSpent);
        assert(user?.profileSyncedAt instanceof Date, "profileSyncedAt 已写入");

        // ---------- (b) 各类非法 token ----------
        console.log("\n(b) 非法 token 均返回 401 / 400：");
        res = await callRoute({ event_token: await signEvent({ membership: { level: "DIAMOND" } }, { aud: "other-client" }) });
        assert(res.status === 401, "错误 aud → 401", res.status);

        const wrongType = await signEvent({ type: "logout" });
        res = await callRoute({ event_token: wrongType });
        assert(res.status === 401, "错误 type → 401", res.status);

        res = await callRoute({ event_token: await signEvent({}, { exp: "-10s" }) });
        assert(res.status === 401, "过期 token → 401", res.status);

        const hs256Token = await new SignJWT({ type: "profile_event" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(STUB_BASE)
            .setAudience(CLIENT_ID)
            .setSubject(USER_ID)
            .setExpirationTime("5m")
            .sign(new TextEncoder().encode("fake-shared-secret"));
        res = await callRoute({ event_token: hs256Token });
        assert(res.status === 401, "HS256 降级 token → 401", res.status);

        res = await callRoute({});
        assert(res.status === 400, "缺 event_token → 400", res.status);
        res = await callRoute({ event_token: "not-a-jwt" });
        assert(res.status === 401, "畸形 token → 401", res.status);

        // 确认 (b) 中的 401 没有改写数据
        user = await prisma.user.findUnique({ where: { id: USER_ID } });
        assert(user?.membershipLevel === "SILVER", "401 请求未改写 membershipLevel", user?.membershipLevel);

        // ---------- (c) 无 membership 字段：只更新 profile ----------
        console.log("\n(c) 无 membership 字段：");
        res = await callRoute({
            event_token: await signEvent({ profile: { nickname: "仅改昵称" } }),
        });
        assert(res.status === 200, "纯 profile 事件返回 200", res.status);
        user = await prisma.user.findUnique({ where: { id: USER_ID } });
        assert(user?.name === "仅改昵称", "name 已更新", user?.name);
        assert(user?.membershipLevel === "SILVER" && user?.totalSpent === 2500, "membershipLevel/totalSpent 保持不变", {
            membershipLevel: user?.membershipLevel,
            totalSpent: user?.totalSpent,
        });

        // ---------- (d) 本地无此用户：200 空操作 ----------
        console.log("\n(d) 用户不存在：");
        const ghostToken = await new SignJWT({
            type: "profile_event",
            membership: { level: "GOLD", totalSpent: 9999 },
        })
            .setProtectedHeader({ alg: "RS256", kid: KID })
            .setIssuer(STUB_BASE)
            .setAudience(CLIENT_ID)
            .setSubject(GHOST_ID)
            .setJti(crypto.randomUUID())
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(privateKey);
        res = await callRoute({ event_token: ghostToken });
        assert(res.status === 200, "不存在用户返回 200（空操作）", res.status);
        const ghost = await prisma.user.findUnique({ where: { id: GHOST_ID } });
        assert(ghost === null, "未创建新用户");
    } finally {
        // ---------- 清理 ----------
        await prisma.user.deleteMany({ where: { id: { in: [USER_ID, GHOST_ID] } } });
        await prisma.$disconnect();
        server.close();
    }

    console.log(`\n结果: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("脚本执行异常:", err);
    process.exit(1);
});
