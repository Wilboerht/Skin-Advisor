/**
 * 内部 API 请求签名工具
 *
 * 用于子站调用官网 /api/v1/internal/* 接口时生成 HMAC-SHA256 签名。
 * 签名算法与官网 src/lib/internal-api.ts 保持一致：
 *   旧格式：HMAC-SHA256(secret, "METHOD|path|timestamp|nonce|bodySha256")
 *   新格式：HMAC-SHA256(secret, "METHOD|path|query|timestamp|nonce|bodySha256")
 *   （query 为 canonicalizeQuery 结果，绑定查询串防篡改；主站开
 *    INTERNAL_API_SIGN_QUERY=true 后启用）
 *
 * 入站（/api/internal/* 被调用方）灰度双验签：先试新格式，失败且
 * INTERNAL_API_REQUIRE_SIGNED_QUERY 未开启时回退旧格式。
 *
 * 同时兼容旧版单一 INTERNAL_API_SECRET（/api/internal/*）。
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import { logger } from "./logger";

export interface InternalApiKeyConfig {
  project: string;
  key: string;
  secret: string;
}

/**
 * 从环境变量读取指定项目的 API 密钥配置
 *
 * 优先读取 INTERNAL_API_KEYS（JSON 数组），找不到时回退到 INTERNAL_API_SECRET。
 */
export function loadInternalApiKey(project: string): InternalApiKeyConfig | null {
  const keysEnv = process.env.INTERNAL_API_KEYS;

  if (keysEnv) {
    try {
      const parsed = JSON.parse(keysEnv) as InternalApiKeyConfig[];
      if (Array.isArray(parsed)) {
        const config = parsed.find(
          (item) => item.project === project && item.key && item.secret
        );
        if (config) return config;
      }
    } catch (error) {
      logger.error("[InternalApi] INTERNAL_API_KEYS 解析失败", { error: String(error) });
    }
  }

  // 兼容旧版单一密钥（切换期间保留，稳定后应移除）
  const legacySecret = process.env.INTERNAL_API_SECRET;
  if (legacySecret) {
    logger.warn(
      "[InternalApi] 使用旧版 INTERNAL_API_SECRET 作为回退，建议尽快配置 INTERNAL_API_KEYS"
    );
    return {
      project: "legacy",
      key: "legacy",
      secret: legacySecret,
    };
  }

  return null;
}

/**
 * 计算请求体 SHA-256 哈希（hex）
 */
export async function hashRequestBody(body: string): Promise<string> {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * 规范化查询串（签名用）：按 key/value 做**码点排序**（不依赖 ICU/locale），
 * 再对 key/value 分别 `encodeURIComponent` 后以 `k=v&...` 拼接。
 *
 * 与官网 src/lib/internal-api.ts 的 canonicalizeQuery 必须逐字节一致——
 * 两端各自对"解码后的参数集合"排序重编码，因此线上传输的编码差异
 * （参数顺序、%20 vs + 等）不影响签名一致性。
 */
export function canonicalizeQuery(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const pairs: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    pairs.push([key, value]);
  }
  // 码点比较：跨语言/跨实现可复现（禁止 localeCompare，避免 ICU 差异导致签名不一致）
  pairs.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return 0;
  });
  return pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/**
 * 生成请求签名
 *
 * @param query - 规范化查询串（canonicalizeQuery）。传入时使用新格式
 *   `METHOD|path|query|timestamp|nonce|bodyHash`（绑定 query，防篡改）；
 *   不传时保持旧格式 `METHOD|path|timestamp|nonce|bodyHash`（仅过渡期使用）
 */
export function generateInternalApiSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  bodyHash: string,
  query?: string
): string {
  const payload =
    query === undefined
      ? `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`
      : `${method.toUpperCase()}|${path}|${query}|${timestamp}|${nonce}|${bodyHash}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * 生成随机 nonce（16 字节 hex）
 */
export function generateInternalApiNonce(): string {
  return randomBytes(16).toString("hex");
}

export interface SignedHeadersResult {
  config: InternalApiKeyConfig;
  headers: Record<string, string>;
}

/**
 * 为官网内部 API v1 创建带签名的请求头
 *
 * 签名固定使用新格式 `METHOD|path|query|timestamp|nonce|bodySha256`（绑定
 * canonical query）：主站入站（/api/v1/internal/* 全部 7 个端点）已按
 * `canonicalizeQuery(实际请求 query)` 双格式验签，且默认仍接受旧格式，
 * 因此子站出站可直接切换，无需灰度开关。
 *
 * @param project - 项目标识，如 "advisor"
 * @param method - HTTP 方法，如 "POST"
 * @param path - 请求路径（不含 query），如 "/api/v1/internal/wechat/send-template"
 * @param bodyText - 请求体 JSON 字符串
 * @param options.query - **线上实际发送的原始查询串**（不含前导 `?`，无 query 省略）；
 *   封装内部做 canonicalizeQuery，保证签名串与线上 query 一致，调用方不得预先排序/重编码
 */
export async function createSignedInternalApiHeaders(
  project: string,
  method: string,
  path: string,
  bodyText: string,
  options?: { query?: string }
): Promise<SignedHeadersResult | null> {
  const config = loadInternalApiKey(project);
  if (!config) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateInternalApiNonce();
  const bodyHash = await hashRequestBody(bodyText);
  const signature = generateInternalApiSignature(
    config.secret,
    method,
    path,
    timestamp,
    nonce,
    bodyHash,
    canonicalizeQuery(options?.query ?? "")
  );

  return {
    config,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Key": config.key,
      "X-Internal-API-Timestamp": String(timestamp),
      "X-Internal-API-Nonce": nonce,
      "X-Internal-API-Signature": signature,
    },
  };
}

// ============================================================
// 入站校验（本服务作为被调用方）
// ============================================================

/** 时间戳允许偏差（秒）：防重放时间窗 */
const INTERNAL_TIMESTAMP_TOLERANCE_SEC = 300;
/** nonce 去重保留时长 */
const NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * nonce 去重（单实例内存）。
 * 注意：PM2 单实例部署下有效；多实例部署需替换为 Redis/DB 去重。
 */
const seenNonces = new Map<string, number>();

function pruneExpiredNonces(now: number): void {
  if (seenNonces.size < 1000) return;
  for (const [nonce, expiresAt] of seenNonces) {
    if (expiresAt <= now) seenNonces.delete(nonce);
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 按客户端传来的 key 查找配置（INTERNAL_API_KEYS 数组内匹配） */
function findInternalApiKeyByKey(key: string): InternalApiKeyConfig | null {
  const keysEnv = process.env.INTERNAL_API_KEYS;
  if (!keysEnv) return null;
  try {
    const parsed = JSON.parse(keysEnv) as InternalApiKeyConfig[];
    if (!Array.isArray(parsed)) return null;
    return parsed.find((item) => item.key === key && item.secret) ?? null;
  } catch {
    return null;
  }
}

export interface VerifyInternalResult {
  ok: boolean;
  /** 失败原因（仅用于服务端日志，不直接返回给调用方） */
  reason?: string;
  config?: InternalApiKeyConfig;
  /** 验签通过时命中的签名格式（灰度观察统计用） */
  signatureFormat?: "query-bound" | "legacy";
}

/** 旧格式（不绑定 query）的灰度开关：true 时仅接受新格式（收口开关） */
function isSignedQueryRequired(): boolean {
  return process.env.INTERNAL_API_REQUIRE_SIGNED_QUERY === "true";
}

/**
 * 完整签名校验：`X-Internal-API-Key/Timestamp/Nonce/Signature`
 *
 * 灰度双验签：优先新格式 `METHOD|path|query|timestamp|nonce|bodySha256`
 * （query 为 canonicalizeQuery 结果，与主站出站格式逐字节对齐）；
 * 未开启 INTERNAL_API_REQUIRE_SIGNED_QUERY 时回退旧格式
 * `METHOD|path|timestamp|nonce|bodySha256`，保证主站切换前的旧调用可用。
 *
 * @param request 入站请求
 * @param rawBody 请求体原文（GET 传空串）；必须与实际请求体一致
 */
export async function verifyInternalRequest(
  request: Request,
  rawBody = ""
): Promise<VerifyInternalResult> {
  const key = request.headers.get("x-internal-api-key") || "";
  const tsRaw = request.headers.get("x-internal-api-timestamp") || "";
  const nonce = request.headers.get("x-internal-api-nonce") || "";
  const signature = request.headers.get("x-internal-api-signature") || "";

  if (!key || !tsRaw || !nonce || !signature) {
    return { ok: false, reason: "missing_signed_headers" };
  }

  const config = findInternalApiKeyByKey(key);
  if (!config) {
    return { ok: false, reason: "unknown_key" };
  }

  const timestamp = Number(tsRaw);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(nowSec - timestamp) > INTERNAL_TIMESTAMP_TOLERANCE_SEC) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const now = Date.now();
  pruneExpiredNonces(now);
  if (seenNonces.has(nonce)) {
    return { ok: false, reason: "nonce_replayed" };
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const canonicalQuery = canonicalizeQuery(url.search);
  const bodyHash = await hashRequestBody(rawBody);

  const candidates: { signature: string; format: "query-bound" | "legacy" }[] = [
    {
      signature: generateInternalApiSignature(
        config.secret,
        request.method,
        path,
        timestamp,
        nonce,
        bodyHash,
        canonicalQuery
      ),
      format: "query-bound",
    },
  ];
  if (!isSignedQueryRequired()) {
    candidates.push({
      signature: generateInternalApiSignature(config.secret, request.method, path, timestamp, nonce, bodyHash),
      format: "legacy",
    });
  }

  let matchedFormat: "query-bound" | "legacy" | null = null;
  for (const candidate of candidates) {
    if (safeEqualHex(candidate.signature, signature)) {
      matchedFormat = candidate.format;
      break;
    }
  }
  if (!matchedFormat) {
    return { ok: false, reason: "signature_mismatch" };
  }

  // 校验通过后再记录 nonce，避免攻击者用无效签名刷掉合法 nonce
  seenNonces.set(nonce, now + NONCE_TTL_MS);
  logger.info("[InternalApi] 签名校验通过", {
    path,
    signatureFormat: matchedFormat,
  });
  return { ok: true, config, signatureFormat: matchedFormat };
}

/** 旧版静态密钥鉴权方式（过渡期兼容，签名头缺失时回退） */
export type LegacyInternalAuth = "x-internal-key" | "bearer-advisor-secret";

export interface AuthorizeInternalResult {
  ok: boolean;
  mode: "signed" | "legacy";
  /** 失败原因（仅用于日志） */
  reason?: string;
  /** HTTP 状态建议（失败时：401 未授权 / 500 服务端未配置 / 503 配置缺失） */
  status?: number;
}

function safeCompareString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * 入站鉴权（过渡期双模式）：
 * 1. 带 `X-Internal-API-*` 签名头 → 走完整签名校验（推荐，防重放）；
 * 2. 未带签名头 → 回退旧版静态密钥（x-internal-key 或 Bearer ADVISOR_INTERNAL_SECRET），
 *    并打 warning 便于追踪未迁移的调用方；
 * 3. 设置 `INTERNAL_API_REQUIRE_SIGNATURE=true` 后旧模式直接拒绝（灰度完成后启用）。
 */
export async function authorizeInternalRequest(
  request: Request,
  opts: { rawBody?: string; legacy: LegacyInternalAuth } = { legacy: "x-internal-key" }
): Promise<AuthorizeInternalResult> {
  const hasSignedHeaders = !!request.headers.get("x-internal-api-signature");

  if (hasSignedHeaders) {
    const result = await verifyInternalRequest(request, opts.rawBody ?? "");
    if (result.ok) return { ok: true, mode: "signed" };
    logger.warn("[InternalApi] 签名校验失败", { reason: result.reason, path: new URL(request.url).pathname });
    return { ok: false, mode: "signed", reason: result.reason, status: 401 };
  }

  if (process.env.INTERNAL_API_REQUIRE_SIGNATURE === "true") {
    logger.warn("[InternalApi] 已强制签名校验，拒绝旧版静态密钥请求", {
      path: new URL(request.url).pathname,
    });
    return { ok: false, mode: "legacy", reason: "signature_required", status: 401 };
  }

  if (opts.legacy === "x-internal-key") {
    const internalKey = process.env.INTERNAL_API_KEY;
    const providedKey = request.headers.get("x-internal-key") || "";
    if (!internalKey || !providedKey || !safeCompareString(internalKey, providedKey)) {
      return { ok: false, mode: "legacy", reason: "invalid_legacy_key", status: 401 };
    }
    logger.warn("[InternalApi] 旧版 x-internal-key 鉴权通过（建议调用方接入签名）", {
      path: new URL(request.url).pathname,
    });
    return { ok: true, mode: "legacy" };
  }

  // bearer-advisor-secret
  const secret = process.env.ADVISOR_INTERNAL_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      // 开发环境仅放行本机请求（避免 dev 完全裸奔）
      const hostname = new URL(request.url).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        logger.warn("[InternalApi] dev 环境未配置 ADVISOR_INTERNAL_SECRET，放行本机请求");
        return { ok: true, mode: "legacy" };
      }
    }
    return { ok: false, mode: "legacy", reason: "advisor_secret_not_configured", status: 500 };
  }
  const authHeader = request.headers.get("authorization") || "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!provided || !safeCompareString(secret, provided)) {
    return { ok: false, mode: "legacy", reason: "invalid_bearer", status: 401 };
  }
  logger.warn("[InternalApi] 旧版 Bearer 鉴权通过（建议调用方接入签名）", {
    path: new URL(request.url).pathname,
  });
  return { ok: true, mode: "legacy" };
}
