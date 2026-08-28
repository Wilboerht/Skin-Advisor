"use client";

// 注意：@fingerprintjs/fingerprintjs 不静态引入——它在问卷页 mount 时就会被连带解析，
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
 * 获取完整的游客身份信息
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

/**
 * 获取已缓存的游客身份（同步方法，用于快速访问）
 */
export function getCachedGuestIdentity(): GuestIdentity | null {
    if (typeof localStorage === 'undefined') return null;

    try {
        const cached = localStorage.getItem(GUEST_IDENTITY_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch {
        // 忽略解析错误
    }

    return null;
}

/**
 * 获取游客ID（优先使用指纹，备用 Cookie ID）
 * 这个方法返回用于API请求的统一ID
 */
export async function getGuestId(): Promise<string> {
    const identity = await getGuestIdentity();
    // 优先使用指纹，因为它更难伪造
    return identity.fingerprint || identity.cookieId;
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

/**
 * 检测设备类型
 */
export function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof navigator === 'undefined') return 'desktop';

    const ua = navigator.userAgent.toLowerCase();

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }

    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(navigator.userAgent)) {
        return 'mobile';
    }

    return 'desktop';
}

/**
 * 检测浏览器类型
 */
export function detectBrowser(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;

    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Edg')) return 'edge';
    if (ua.includes('Chrome')) return 'chrome';
    if (ua.includes('Safari')) return 'safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'opera';

    return 'unknown';
}

/**
 * 检测操作系统
 */
export function detectOS(): string {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;

    if (ua.includes('Win')) return 'windows';
    if (ua.includes('Mac')) return 'macos';
    if (ua.includes('Linux')) return 'linux';
    if (ua.includes('Android')) return 'android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';

    return 'unknown';
}
