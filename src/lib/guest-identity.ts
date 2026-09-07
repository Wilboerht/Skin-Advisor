"use client";

// 注意：@fingerprintjs/fingerprintjs 不静态引入——face-scan 页 mount 时会被连带解析，
// 改为在 getFingerprint 内动态 import，避免进入页面时的主线程长任务挤占交互响应。

// 常量定义
const COOKIE_NAME = 'nihplod_guest_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年
const FINGERPRINT_CACHE_KEY = 'nihplod_fingerprint';
const GUEST_IDENTITY_KEY = 'nihplod_guest_identity';

// 游客身份接口
export interface GuestIdentity {
    cookieId: string;
    fingerprint: string | null;
    timestamp: number;
}

// ===== Cookie 操作 =====

/**
 * 设置 Cookie
 */
function setCookie(name: string, value: string, maxAge: number): void {
    if (typeof document === 'undefined') return;
    // Secure flag only on HTTPS to avoid dropping the cookie on local HTTP dev.
    // HttpOnly cannot be set from JavaScript; to enforce HttpOnly this cookie
    // must be migrated to a server-side Set-Cookie header.
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * 获取 Cookie
 */
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) {
            return decodeURIComponent(value);
        }
    }
    return null;
}

/**
 * 生成或获取 Cookie ID
 */
export function getOrCreateCookieId(): string {
    let cookieId = getCookie(COOKIE_NAME);

    if (!cookieId) {
        // 生成新的 Cookie ID
        cookieId = generateUUID();
        setCookie(COOKIE_NAME, cookieId, COOKIE_MAX_AGE);
    }

    return cookieId;
}

// ===== 浏览器指纹 =====

let fingerprintPromise: Promise<string | null> | null = null;

/**
 * 获取浏览器指纹（使用 FingerprintJS）
 */
export async function getFingerprint(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // 先检查缓存
    const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            // 缓存24小时有效
            if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                return data.fingerprint;
            }
        } catch {
            // 忽略解析错误
        }
    }

    // 避免重复加载
    if (!fingerprintPromise) {
        fingerprintPromise = (async (): Promise<string | null> => {
            try {
                const { default: FingerprintJS } = await import('@fingerprintjs/fingerprintjs');
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                const fingerprint = result.visitorId;

                // 缓存结果
                localStorage.setItem(FINGERPRINT_CACHE_KEY, JSON.stringify({
                    fingerprint,
                    timestamp: Date.now()
                }));

                return fingerprint;
            } catch (error) {
                console.error('Failed to get fingerprint:', error);
                return null;
            }
        })();
    }

    return fingerprintPromise;
}

// ===== 综合游客身份 =====

/**
 * 获取完整的游客身份信息（face-scan → OSS 直传路径隔离仍在用）
 */
export async function getGuestIdentity(): Promise<GuestIdentity> {
    const cookieId = getOrCreateCookieId();
    const fingerprint = await getFingerprint();

    const identity: GuestIdentity = {
        cookieId,
        fingerprint,
        timestamp: Date.now()
    };

    // 保存到 localStorage 作为备份
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GUEST_IDENTITY_KEY, JSON.stringify(identity));
    }

    return identity;
}

// ===== 工具函数 =====

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
