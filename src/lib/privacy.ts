/**
 * Privacy utilities for data anonymization.
 * Used to hash personally identifiable information (PII) before database storage.
 */
import { createHash } from 'crypto';

/**
 * Hash an IP address using SHA-256 for privacy-compliant storage.
 * Returns a truncated 16-char hex string — sufficient for uniqueness
 * in rate-limiting and deduplication, but irreversible.
 *
 * Note: The salt uses a server-side env var so hashes are consistent
 * across requests but not reproducible outside this deployment.
 */
export function hashIP(ip: string): string {
    const salt = process.env.IP_HASH_SALT;
    if (!salt) {
        if (process.env.NODE_ENV !== 'development') {
            throw new Error(
                '🔴 CRITICAL: IP_HASH_SALT environment variable is not set. ' +
                'Refusing to hash IPs without a proper salt in non-development environment.'
            );
        }
        console.warn('⚠️  IP_HASH_SALT not set — using development fallback. Do NOT use in production.');
    }
    return createHash('sha256')
        .update(`${salt!}:${ip}`)
        .digest('hex')
        .substring(0, 16);
}
