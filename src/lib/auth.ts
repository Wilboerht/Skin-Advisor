
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                '🔴 CRITICAL: JWT_SECRET environment variable is not set. ' +
                'Refusing to start in production with a hardcoded secret. ' +
                'Set JWT_SECRET in your environment variables.'
            );
        }
        // Development fallback only — never used in production
        console.warn('⚠️  JWT_SECRET not set — using development fallback. Do NOT use in production.');
    }
    return new TextEncoder().encode(secret || 'dev_only_fallback_secret_not_for_production');
}

const JWT_SECRET = getJwtSecret();

export async function hashPassword(plain: string): Promise<string> {
    return hash(plain, 12);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
}

export async function signToken(payload: any, expiresIn: string | number = '7d'): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (err) {
        return null; // Invalid token
    }
}

export interface SessionUser {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    vipExpiresAt?: string | null; // ISO Date string
}

export async function getSession(): Promise<SessionUser | null> {
    const cookieStore = await cookies();

    const tokenValue = cookieStore.get('auth_token')?.value;
    if (!tokenValue) {
        return null;
    }

    const payload = await verifyToken(tokenValue);
    if (payload) {
        const userId = (payload.sub as string) || (payload.userId as string);
        if (userId) {
            return {
                id: userId,
                email: (payload.email as string) || null,
                phone: (payload.phone as string) || null,
                name: payload.name as string,
                role: payload.role as string || 'user',
                vipExpiresAt: payload.vipExpiresAt || null
            };
        }
        return null;
    }

    return null;
}

/**
 * 判断用户是否为有效的 VIP
 */
export function isVipCheck(user: { role?: string; vipExpiresAt?: string | null | Date } | null | undefined): boolean {
    if (!user) return false;
    // 1. Check role
    if (user.role === 'vip') {
        // 2. Check expiration if present
        if (user.vipExpiresAt) {
            return new Date(user.vipExpiresAt).getTime() > Date.now();
        }
        // If no expiry set but role is vip, assume permanent or indefinite vip for now (or treat as valid)
        return true;
    }
    // Admin is also considered VIP for testing purposes? Or strictly separate?
    // Usually admin has all access, but for explicit "VIP feature" check:
    if (user.role === 'admin' || user.role === 'super_admin') return true;

    return false;
}
