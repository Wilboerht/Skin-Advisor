/**
 * PM2 生产环境配置
 * 注意：当前应用使用内存中后台队列处理器，必须使用 fork 模式 + 单实例
 * 不要启用 cluster 模式，否则多个进程会竞争处理同一个 AvatarQueue
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
        max_memory_restart: '2G',
        // 优雅关闭
        kill_timeout: 5000,
        listen_timeout: 10000,
        // 环境变量文件
        env_file: './.env.production',
    }]
};
