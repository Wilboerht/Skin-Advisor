/**
 * PM2 生产环境配置
 * 注意：当前应用使用内存中限流器，必须使用 fork 模式 + 单实例
 * 不要启用 cluster 模式，否则多个进程会竞争处理同一限流计数
 * 
 * 安全警告：切勿在此文件中硬编码 API Key！
 * 所有敏感配置应通过 env_file 指定的 .env.production 文件加载。
 */
module.exports = {
    apps: [{
        name: 'skin-advisor',
        script: 'node .next/standalone/server.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            PORT: 3002,
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
        // 内存限制
        max_memory_restart: '6G',
        // 优雅关闭 (15s 充足余量)
        kill_timeout: 15000,
        listen_timeout: 10000,
        // 环境变量文件
        env_file: './.env.production',
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
