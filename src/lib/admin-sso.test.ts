import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { exportJWK, exportSPKI, generateKeyPair, SignJWT } from "jose";
import {
  ADMIN_SSO_AUDIENCE,
  ADMIN_SSO_ISSUER,
  AdminSsoError,
  createPkcePair,
  createSsoState,
  resolveLocalAdminRole,
  verifyAdminSsoAssertion,
  type AdminSsoClaims,
  type AdminSsoConfig,
} from "./admin-sso";
import { verifyTotp } from "./totp";

let privateKey: CryptoKey;
let publicKeyPem: string;
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  privateKey = pair.privateKey;
  publicKeyPem = await exportSPKI(pair.publicKey);
  publicJwk = await exportJWK(pair.publicKey);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let jtiCounter = 0;
function nextJti(): string {
  jtiCounter += 1;
  return `test-jti-${jtiCounter}`;
}

function claims(overrides: Partial<AdminSsoClaims> = {}): AdminSsoClaims {
  return {
    iss: "https://nihplod.cn",
    aud: "advisor-admin",
    sub: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    permissions: ["advisor:access"],
    advisorRole: "admin",
    ver: 1,
    totp: true,
    mainSessionExp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    jti: "jti-1",
    ...overrides,
  };
}

function rs256Config(publicKey: string | null): AdminSsoConfig {
  return {
    enabled: true,
    authorizeUrl: "https://nihplod.cn/admin/sso/authorize",
    issuer: "https://nihplod.cn",
    tokenUrl: "http://127.0.0.1:3000/api/admin/sso/token",
    statusUrl: "http://127.0.0.1:3000/api/admin/sso/status",
    jwksUrl: "https://nihplod.cn/api/oauth/jwks",
    clientId: "advisor-admin",
    clientSecret: "c".repeat(32),
    redirectUri: "https://smart.nihplod.cn/api/admin/auth/sso/callback",
    publicKey,
    allowLegacyHs256: false,
    legacySecret: null,
    sessionTtlMinutes: 540,
  };
}

async function signRs256Assertion(
  options: { tokenUse?: string | null; keyId?: string } = {}
): Promise<string> {
  const payload: Record<string, unknown> = {
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    permissions: ["advisor:access"],
    advisorRole: "admin",
    ver: 2,
    totp: true,
    mainSessionExp: Math.floor(Date.now() / 1000) + 600,
  };
  if (options.tokenUse !== null) {
    payload.token_use = options.tokenUse ?? "admin_sso";
  }

  return new SignJWT(payload)
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
      kid: options.keyId ?? "advisor-admin-rs256-v1",
    })
    .setIssuer(ADMIN_SSO_ISSUER)
    .setAudience(ADMIN_SSO_AUDIENCE)
    .setSubject("admin-1")
    .setJti(nextJti())
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(privateKey);
}

async function signLegacyHs256Assertion(secret: string): Promise<string> {
  return new SignJWT({
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    permissions: ["advisor:access"],
    advisorRole: "admin",
    ver: 2,
    totp: true,
    mainSessionExp: Math.floor(Date.now() / 1000) + 600,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ADMIN_SSO_ISSUER)
    .setAudience(ADMIN_SSO_AUDIENCE)
    .setSubject("admin-1")
    .setJti(nextJti())
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret));
}

describe("admin-sso (sub-site)", () => {
  it("generates a valid state and PKCE pair", () => {
    expect(createSsoState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("maps main-site claims to local roles", () => {
    expect(resolveLocalAdminRole(claims({ role: "owner", advisorRole: "super_admin", permissions: [] }))).toBe("super_admin");
    expect(resolveLocalAdminRole(claims({ permissions: ["advisor:admin"], advisorRole: "super_admin" }))).toBe("super_admin");
    expect(resolveLocalAdminRole(claims())).toBe("admin");
    expect(resolveLocalAdminRole(claims({ permissions: [] }))).toBeNull();
    expect(resolveLocalAdminRole(claims({ advisorRole: "super_admin", permissions: ["advisor:access"] }))).toBeNull();
  });

  it("verifies RFC 6238 TOTP vector", () => {
    // ASCII "12345678901234567890" -> base32
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotp(secret, "287082", 0, 59_000)).toBe(true);
    expect(verifyTotp(secret, "000000", 0, 59_000)).toBe(false);
  });

  it("verifies an RS256 main-site assertion", async () => {
    const assertion = await signRs256Assertion();
    const verified = await verifyAdminSsoAssertion(assertion, rs256Config(publicKeyPem));
    expect(verified.sub).toBe("admin-1");
    expect(verified.advisorRole).toBe("admin");
    expect(verified.permissions).toContain("advisor:access");
    expect(verified.mainSessionExp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("verifies RS256 via JWKS when no static public key is configured", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          keys: [
            {
              ...publicJwk,
              kid: "advisor-admin-rs256-v1",
              alg: "RS256",
              use: "sig",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const assertion = await signRs256Assertion();
    const verified = await verifyAdminSsoAssertion(assertion, rs256Config(null));

    expect(verified.sub).toBe("admin-1");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects an RS256 assertion without token_use", async () => {
    const assertion = await signRs256Assertion({ tokenUse: null });
    await expect(
      verifyAdminSsoAssertion(assertion, rs256Config(publicKeyPem))
    ).rejects.toMatchObject({ code: "INVALID_ASSERTION" });
  });

  it("rejects HS256 unless legacy fallback is explicitly enabled", async () => {
    const secret = "s".repeat(32);
    const assertion = await signLegacyHs256Assertion(secret);

    await expect(
      verifyAdminSsoAssertion(assertion, rs256Config(publicKeyPem))
    ).rejects.toBeInstanceOf(AdminSsoError);

    const legacyConfig: AdminSsoConfig = {
      ...rs256Config(publicKeyPem),
      allowLegacyHs256: true,
      legacySecret: secret,
    };
    const verified = await verifyAdminSsoAssertion(assertion, legacyConfig);
    expect(verified.advisorRole).toBe("admin");
  });
});
