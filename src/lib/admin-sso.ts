/**
 * 子站侧主站管理员 SSO
 *
 * 子站不保存管理员密码/权限来源：
 * - 账号身份、密码、TOTP、角色、权限均以主站为准；
 * - 子站只保留影子 AdminUser（会话/审计/同步用）；
 * - 断言由主站用 ADMIN_SSO_SECRET 签发，子站验签后签发本地会话。
 */
import { createHash, randomBytes } from "crypto";
import { jwtVerify } from "jose";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createSignedSession } from "@/lib/session-verify";
import { AdminRole } from "@/lib/permissions";

export const ADMIN_SSO_AUDIENCE = "advisor-admin";
export const ADMIN_SSO_ISSUER = "https://nihplod.cn";

export const ADMIN_SSO_STATE_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-admin_sso_state"
    : "admin_sso_state";
export const ADMIN_SSO_VERIFIER_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-admin_sso_verifier"
    : "admin_sso_verifier";
export const ADMIN_SSO_RETURN_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-admin_sso_return"
    : "admin_sso_return";

export const ADMIN_SSO_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300,
};

export interface AdminSsoConfig {
  enabled: boolean;
  authorizeUrl: string;
  issuer: string;
  tokenUrl: string;
  statusUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  secret: string;
  sessionTtlMinutes: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[AdminSSO] ${name} 未配置`);
  return value;
}

export function getAdminSsoConfig(): AdminSsoConfig {
  const ttlRaw = Number(process.env.ADMIN_SSO_SESSION_TTL_MINUTES || "540");
  const authorizeUrl = required("ADMIN_SSO_AUTHORIZE_URL");
  let issuer = ADMIN_SSO_ISSUER;
  try {
    issuer = new URL(authorizeUrl).origin;
  } catch {
    // 保留默认 issuer；配置错误会在 authorize 跳转时暴露
  }
  const clientSecret = required("ADMIN_SSO_CLIENT_SECRET");
  const secret = required("ADMIN_SSO_SECRET");
  if (clientSecret.length < 32) {
    throw new Error("[AdminSSO] ADMIN_SSO_CLIENT_SECRET 至少需要 32 位");
  }
  if (secret.length < 32) {
    throw new Error("[AdminSSO] ADMIN_SSO_SECRET 至少需要 32 位");
  }

  const tokenUrl = required("ADMIN_SSO_TOKEN_URL");
  const statusUrl = required("ADMIN_SSO_STATUS_URL");
  for (const [name, value] of [
    ["ADMIN_SSO_TOKEN_URL", tokenUrl],
    ["ADMIN_SSO_STATUS_URL", statusUrl],
  ] as const) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`[AdminSSO] ${name} 不是合法 URL`);
    }
    // 换票/状态接口会携带 client_secret：只允许 https，或同机回环地址
    if (
      parsed.protocol !== "https:" &&
      !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    ) {
      throw new Error(`[AdminSSO] ${name} 必须使用 https 或本机回环地址`);
    }
  }

  return {
    enabled: process.env.ADMIN_SSO_ENABLED !== "false",
    authorizeUrl,
    issuer,
    tokenUrl,
    statusUrl,
    clientId: required("ADMIN_SSO_CLIENT_ID"),
    clientSecret,
    redirectUri: required("ADMIN_SSO_REDIRECT_URI"),
    secret,
    // 硬上限 9 小时，防止误配成超长会话
    sessionTtlMinutes:
      Number.isFinite(ttlRaw) && ttlRaw > 0
        ? Math.min(Math.floor(ttlRaw), 540)
        : 540,
  };
}

export class AdminSsoError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "AdminSsoError";
  }
}

export interface AdminSsoClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  advisorRole: "super_admin" | "admin";
  ver: number;
  totp: boolean;
  mainSessionExp: number;
  iat: number;
  exp: number;
  jti: string;
}

export function createSsoState(): string {
  return randomBytes(32).toString("base64url");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * 校验主站断言。调用方必须先完成 code 换票。
 */
export async function verifyAdminSsoAssertion(
  assertion: string,
  config: AdminSsoConfig
): Promise<AdminSsoClaims> {
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(
      assertion,
      new TextEncoder().encode(config.secret),
      {
        issuer: config.issuer,
        audience: ADMIN_SSO_AUDIENCE,
        algorithms: ["HS256"],
        clockTolerance: 30,
      }
    );
    payload = result.payload as Record<string, unknown>;
  } catch {
    throw new AdminSsoError("INVALID_ASSERTION", "管理员断言无效或已过期", 401);
  }

  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.filter((item): item is string => typeof item === "string")
    : [];

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.role !== "string" ||
    (payload.advisorRole !== "super_admin" && payload.advisorRole !== "admin") ||
    typeof payload.ver !== "number" ||
    !Number.isFinite(payload.ver) ||
    typeof payload.totp !== "boolean" ||
    typeof payload.mainSessionExp !== "number" ||
    !Number.isFinite(payload.mainSessionExp) ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    typeof payload.jti !== "string"
  ) {
    throw new AdminSsoError("INVALID_ASSERTION", "管理员断言字段不完整", 401);
  }

  if (payload.mainSessionExp * 1000 <= Date.now()) {
    throw new AdminSsoError("MAIN_SESSION_EXPIRED", "主站登录已过期，请重新登录", 401);
  }

  if (!consumeAssertionJti(payload.jti, payload.exp)) {
    throw new AdminSsoError("ASSERTION_REPLAYED", "管理员断言已被使用", 401);
  }

  return {
    iss: String(payload.iss),
    aud: String(payload.aud),
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    permissions,
    advisorRole: payload.advisorRole,
    ver: payload.ver,
    totp: payload.totp,
    mainSessionExp: payload.mainSessionExp,
    iat: typeof payload.iat === "number" ? payload.iat : 0,
    exp: payload.exp,
    jti: payload.jti,
  };
}

/**
 * 根据断言中的权限重新计算子站角色，必须与 advisorRole 一致。
 * 防止只伪造单个 advisorRole 字段（即使断言密钥泄露也要求权限集匹配）。
 */
export function resolveLocalAdminRole(claims: AdminSsoClaims): "super_admin" | "admin" | null {
  const isSuper =
    claims.role === "owner" || claims.permissions.includes("advisor:admin");
  if (claims.advisorRole === "super_admin" && isSuper) return AdminRole.SUPER_ADMIN;
  if (
    claims.advisorRole === "admin" &&
    claims.permissions.includes("advisor:access")
  ) {
    return AdminRole.ADMIN;
  }
  return null;
}

const usedJti = new Map<string, number>();

function consumeAssertionJti(jti: string, expSeconds: number): boolean {
  const now = Date.now();
  for (const [key, expiresAt] of usedJti) {
    if (expiresAt <= now) usedJti.delete(key);
  }
  if (usedJti.has(jti)) return false;
  usedJti.set(jti, expSeconds * 1000 + 60_000);
  return true;
}

export interface ShadowAdminResult {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  passwordChangedAt: Date | null;
}

function sanitizeUsernameBase(email: string): string {
  const local = email.split("@")[0] || "admin";
  const cleaned = local.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32);
  return cleaned || "admin";
}

async function uniqueUsername(
  tx: Prisma.TransactionClient,
  base: string
): Promise<string> {
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const exists = await tx.adminUser.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * 按 externalAdminId 优先、email 兜底 upsert 影子账号。
 * 不修改已有 password（保留回滚能力；清理阶段再统一置空）。
 */
export async function upsertShadowAdmin(
  claims: AdminSsoClaims,
  localRole: "super_admin" | "admin"
): Promise<ShadowAdminResult> {
  return prisma.$transaction(async (tx) => {
    const existingByExternal = await tx.adminUser.findUnique({
      where: { externalAdminId: claims.sub },
    });

    if (existingByExternal) {
      return tx.adminUser.update({
        where: { id: existingByExternal.id },
        data: {
          email: claims.email,
          name: claims.name,
          role: localRole,
          active: true,
          externalAdminId: claims.sub,
          externalRole: claims.role,
          externalTokenVersion: claims.ver,
          mainTotpEnabled: claims.totp,
          authSource: "sso",
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          passwordChangedAt: true,
        },
      });
    }

    const existingByEmail = await tx.adminUser.findFirst({
      where: { email: { equals: claims.email, mode: "insensitive" } },
    });

    if (existingByEmail) {
      if (
        existingByEmail.externalAdminId &&
        existingByEmail.externalAdminId !== claims.sub
      ) {
        throw new AdminSsoError(
          "EMAIL_CONFLICT",
          "该邮箱已绑定其他主站管理员，请联系主站处理",
          409
        );
      }
      return tx.adminUser.update({
        where: { id: existingByEmail.id },
        data: {
          email: claims.email,
          name: claims.name,
          role: localRole,
          active: true,
          externalAdminId: claims.sub,
          externalRole: claims.role,
          externalTokenVersion: claims.ver,
          mainTotpEnabled: claims.totp,
          authSource: "sso",
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          passwordChangedAt: true,
        },
      });
    }

    const username = await uniqueUsername(tx, sanitizeUsernameBase(claims.email));
    return tx.adminUser.create({
      data: {
        username,
        email: claims.email,
        password: null,
        name: claims.name,
        role: localRole,
        active: true,
        externalAdminId: claims.sub,
        externalRole: claims.role,
        externalTokenVersion: claims.ver,
        mainTotpEnabled: claims.totp,
        authSource: "sso",
        lastLoginAt: new Date(),
        lastSyncedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        passwordChangedAt: true,
      },
    });
  });
}

export interface SsoSessionResult {
  cookieValue: string;
  maxAgeSeconds: number;
}

/**
 * 签发本地 SSO 会话：
 * - 配置上限 9 小时；
 * - 不超过主站管理员 JWT 剩余寿命；
 * - 返回与 TTL 一致的 Cookie maxAge。
 */
export async function createSsoAdminSession(
  shadow: ShadowAdminResult,
  claims: AdminSsoClaims,
  config: AdminSsoConfig,
  passwordChangedAt: string | null
): Promise<SsoSessionResult> {
  const configuredTtlMs = config.sessionTtlMinutes * 60 * 1000;
  const mainRemainingMs = claims.mainSessionExp * 1000 - Date.now();
  const ttlMs = Math.min(configuredTtlMs, mainRemainingMs);

  if (!Number.isFinite(ttlMs) || ttlMs <= 60_000) {
    throw new AdminSsoError("MAIN_SESSION_EXPIRED", "主站登录即将过期，请重新登录", 401);
  }

  const cookieValue = await createSignedSession(
    {
      adminId: shadow.id,
      username: shadow.username,
      role: shadow.role,
      passwordChangedAt,
      externalAdminId: claims.sub,
      authSource: "sso",
      mainTotpEnabled: claims.totp,
    },
    { ttlMs }
  );

  return { cookieValue, maxAgeSeconds: Math.floor(ttlMs / 1000) };
}

/**
 * 服务端到服务端用 code + PKCE 换断言。
 */
export async function exchangeAdminSsoCode(
  code: string,
  codeVerifier: string,
  config: AdminSsoConfig
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    throw new AdminSsoError("TOKEN_ENDPOINT_UNREACHABLE", "主站认证服务不可达", 502);
  }

  const json = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: { assertion?: string }; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok || !json?.success || !json.data?.assertion) {
    throw new AdminSsoError(
      json?.error?.code || "TOKEN_EXCHANGE_FAILED",
      json?.error?.message || "主站管理员认证失败",
      response.status >= 400 ? response.status : 502
    );
  }

  return json.data.assertion;
}

export interface MainAdminStatus {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  advisorRole: "super_admin" | "admin" | null;
  ver: number;
  status: string;
  deletedAt: string | null;
  totpEnabled: boolean;
}

/**
 * 批量拉取主站管理员状态（同步 cron 使用）。
 */
export async function fetchMainAdminStatuses(
  adminIds: string[],
  config: AdminSsoConfig
): Promise<MainAdminStatus[]> {
  if (adminIds.length === 0) return [];
  let response: Response;
  try {
    response = await fetch(config.statusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        adminIds: adminIds.slice(0, 100),
      }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    throw new AdminSsoError("STATUS_ENDPOINT_UNREACHABLE", "主站状态接口不可达", 502);
  }

  const json = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        data?: { admins?: MainAdminStatus[] };
        error?: { code?: string; message?: string };
      }
    | null;
  if (!response.ok || !json?.success) {
    throw new AdminSsoError(
      json?.error?.code || "STATUS_ENDPOINT_FAILED",
      json?.error?.message || "主站管理员状态同步失败",
      response.status >= 400 ? response.status : 502
    );
  }
  return json.data?.admins ?? [];
}
