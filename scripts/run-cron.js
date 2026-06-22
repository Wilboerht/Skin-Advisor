#!/usr/bin/env node
require('dotenv').config();
/**
 * Cron 任务执行脚本（云服务器环境）
 *
 * 用法：
 *   node scripts/run-cron.js /api/cron/vip-expiry
 *   node scripts/run-cron.js /api/cron/data-cleanup
 *
 * 配合 Linux crontab：
 *   0 2 * * * cd /path/to/app && /usr/bin/node scripts/run-cron.js /api/cron/vip-expiry >> /var/log/myskin-cron.log 2>&1
 *   */30 * * * * cd /path/to/app && /usr/bin/node scripts/run-cron.js /api/cron/data-cleanup >> /var/log/myskin-cron.log 2>&1
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL;

async function runCron(path) {
    if (!CRON_SECRET) {
        console.error('[Cron] CRON_SECRET environment variable is not set');
        process.exit(1);
    }
    if (!BASE_URL) {
        console.error('[Cron] NEXT_PUBLIC_SITE_URL environment variable is not set');
        process.exit(1);
    }

    const url = `${BASE_URL}${path}`;
    const startTime = Date.now();

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${CRON_SECRET}` }
        });

        const data = await res.json().catch(() => ({}));
        const duration = Date.now() - startTime;

        console.log(`[${new Date().toISOString()}] ${path} (${duration}ms):`, JSON.stringify(data));

        if (!res.ok) {
            process.exit(1);
        }
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ${path} failed:`, err.message);
        process.exit(1);
    }
}

const path = process.argv[2];
if (!path) {
    console.error('Usage: node scripts/run-cron.js <cron-path>');
    console.error('Example: node scripts/run-cron.js /api/cron/data-cleanup');
    process.exit(1);
}

runCron(path);
