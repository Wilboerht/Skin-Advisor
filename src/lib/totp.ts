/**
 * 最小 TOTP 实现（仅用于本地 break-glass 应急账号）
 *
 * 正常管理员登录走主站 SSO，TOTP 由主站负责；子站只在应急入口校验
 * BREAK_GLASS_TOTP_SECRET，避免为单个应急账号引入完整 TOTP 存储/管理子系统。
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 secret");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function generateTotpSecret(bytes = 20): string {
  const buffer = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateHotp(key: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * 校验 6 位 TOTP，默认允许前后 1 个 30 秒窗口。
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  window = 1,
  now = Date.now()
): boolean {
  const normalized = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  let key: Buffer;
  try {
    key = base32Decode(secretBase32);
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const counter = Math.floor(now / 30_000);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateHotp(key, counter + offset);
    if (
      expected.length === normalized.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
    ) {
      return true;
    }
  }
  return false;
}

export function buildTotpUri(
  secretBase32: string,
  accountName: string,
  issuer = "NIHPLOD"
): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
