/**
 * PM2 生产环境配置
 * 注意：当前应用使用内存中限流器，必须使用 fork 模式 + 单实例
 * 不要启用 cluster 模式，否则多个进程会竞争处理同一限流计数
 * 
 * 安全警告：切勿在此文件中硬编码 API Key！
 * 敏感配置由 scripts/copy-standalone-assets.js 复制到
 * .next/standalone/.env.production，standalone server.js 启动时读取。
 * PM2 的 env_file 不是官方支持的配置项，不要依赖它。
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function readProductionEnv() {
    try {
        const envPath = path.join(__dirname, '.env.production');
        return fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
    } catch {
        return {};
    }
}

const productionEnv = readProductionEnv();
const internalApiKeys = productionEnv.INTERNAL_API_KEYS;
if (internalApiKeys) {
    try {
        const parsed = JSON.parse(internalApiKeys);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('必须是非空 JSON 数组');
        }
    } catch (error) {
        throw new Error(`.env.production 的 INTERNAL_API_KEYS 不是合法 JSON: ${error.message}`);
    }
}
const securityEnv = {};
for (const key of ['INTERNAL_API_KEYS', 'ADVISOR_INTERNAL_SECRET', 'INTERNAL_API_REQUIRE_SIGNED_QUERY']) {
    if (productionEnv[key]) securityEnv[key] = productionEnv[key];
}

module.exports = {
    apps: [{
        name: 'skin-advisor',
        // 直接以 Node 运行 standalone server，避免 bash -c 包装导致
        // PM2 无法正确监控 Node 内存/信号。
        script: '.next/standalone/server.js',
        cwd: __dirname,
        interpreter: 'node',
        node_args: '--max-old-space-size=2048',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            PORT: 3002,
            ...securityEnv,
            // QWEN_API_KEY 等敏感配置请从 .env.production 读取
            // 不要在这里写死，以免泄露到 Git 仓库
        },
        // 日志配置
        log_file: './logs/combined.log',
        out_file: './logs/out.log',
        error_file: './logs/error.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        // 自动重启策略
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        // 内存限制：服务器 4G，Node heap 2G；3G RSS 触发重启，低于整机 OOM
        max_memory_restart: '3G',
        // 优雅关闭 (15s 充足余量)
        kill_timeout: 15000,
        listen_timeout: 10000,
    }]
};

/**
 * ====================================
 * PM2 Logrotate 配置（部署后执行一次）:
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 30
 *   pm2 set pm2-logrotate:compress true
 * ====================================
 */
