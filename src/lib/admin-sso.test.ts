import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  ADMIN_SSO_AUDIENCE,
  ADMIN_SSO_ISSUER,
  createPkcePair,
  createSsoState,
  resolveLocalAdminRole,
  verifyAdminSsoAssertion,
  type AdminSsoClaims,
  type AdminSsoConfig,
} from "./admin-sso";
import { verifyTotp } from "./totp";

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

  it("verifies a signed main-site assertion", async () => {
    const secret = "s".repeat(32);
    const config: AdminSsoConfig = {
      enabled: true,
      authorizeUrl: "https://nihplod.cn/admin/sso/authorize",
      issuer: "https://nihplod.cn",
      tokenUrl: "http://127.0.0.1:3000/api/admin/sso/token",
      statusUrl: "http://127.0.0.1:3000/api/admin/sso/status",
      clientId: "advisor-admin",
      clientSecret: "c".repeat(32),
      redirectUri: "https://smart.nihplod.cn/api/admin/auth/sso/callback",
      secret,
      sessionTtlMinutes: 540,
    };
    const mainSessionExp = Math.floor(Date.now() / 1000) + 600;
    const assertion = await new SignJWT({
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      permissions: ["advisor:access"],
      advisorRole: "admin",
      ver: 2,
      totp: true,
      mainSessionExp,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(ADMIN_SSO_ISSUER)
      .setAudience(ADMIN_SSO_AUDIENCE)
      .setSubject("admin-1")
      .setJti("test-jti-1")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(secret));

    const verified = await verifyAdminSsoAssertion(assertion, config);
    expect(verified.sub).toBe("admin-1");
    expect(verified.advisorRole).toBe("admin");
    expect(verified.permissions).toContain("advisor:access");
    expect(verified.mainSessionExp).toBe(mainSessionExp);
  });
});
