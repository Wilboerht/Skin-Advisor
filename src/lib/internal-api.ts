/**
 * 内部 API 请求签名工具
 *
 * 用于子站调用官网 /api/v1/internal/* 接口时生成 HMAC-SHA256 签名。
 * 签名算法与官网 src/lib/internal-api.ts 保持一致：
 *   signature = HMAC-SHA256(secret, "METHOD|path|timestamp|nonce|bodySha256")
 *
 * 同时兼容旧版单一 INTERNAL_API_SECRET（/api/internal/*）。
 */

import { createHmac, createHash, randomBytes } from "crypto";
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
 * 生成请求签名
 */
export function generateInternalApiSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: number,
  nonce: string,
  bodyHash: string
): string {
  const payload = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyHash}`;
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
 * @param project - 项目标识，如 "advisor"
 * @param method - HTTP 方法，如 "POST"
 * @param path - 请求路径，如 "/api/v1/internal/wechat/send-template"
 * @param bodyText - 请求体 JSON 字符串
 */
export async function createSignedInternalApiHeaders(
  project: string,
  method: string,
  path: string,
  bodyText: string
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
    bodyHash
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
