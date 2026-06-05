/**
 * Node.js 应用初始化
 * 在服务器启动时运行一次性的初始化任务
 */

export async function register() {
    // 严格跳过 Edge Runtime：instrumentation hook 在 Edge Runtime 中也会被调用，
    // 但 avatar-queue-processor 依赖的 @volcengine/openapi 使用了 Node.js crypto 模块，
    // 会导致 "The edge runtime does not support Node.js 'crypto' module" 错误
    if (process.env.NEXT_RUNTIME === 'edge') {
        return;
    }

    console.log('[init] Application starting...');

    // 注册实例到多实例检测表（用于检测限流是否能在多实例下正常工作）
    try {
        const { registerInstance, unregisterInstance } = await import('@/lib/instance-check');
        await registerInstance();

        if (typeof process !== 'undefined' && process.on) {
            process.on('SIGTERM', async () => {
                await unregisterInstance();
            });
            process.on('SIGINT', async () => {
                await unregisterInstance();
            });
        }
    } catch (e) {
        console.warn('[init] Instance check registration failed:', e);
    }

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
