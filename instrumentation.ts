/**
 * Node.js 应用初始化
 * 在服务器启动时运行一次性的初始化任务
 */

export async function register() {
    console.log('[init] Application starting...');

    // 注册 Prisma 优雅关闭（仅 Node.js runtime）
    if (typeof process !== 'undefined' && process.on) {
        const { default: prisma } = await import('@/lib/prisma');
        process.on('SIGTERM', async () => {
            console.log('[Prisma] SIGTERM received, disconnecting...');
            await prisma.$disconnect();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            console.log('[Prisma] SIGINT received, disconnecting...');
            await prisma.$disconnect();
            process.exit(0);
        });
    }

    if (process.env.NODE_ENV === 'production') {
        console.log('[init] Starting avatar queue processor...');
        const { startAvatarQueueProcessor } = await import('@/lib/avatar-queue-processor');
        // 启动后台队列处理器，每 2 秒检查一次
        startAvatarQueueProcessor(2000);
    } else {
        console.log('[init] Skipping avatar queue processor in development');
    }
}
