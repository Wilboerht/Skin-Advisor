import { registerInstance, unregisterInstance } from './instance-check';
import prisma from './prisma';
import { startAvatarQueueProcessor } from './avatar-queue-processor';

export async function initNode() {
    console.log('[init] Application starting...');

    // 注册实例到多实例检测表（用于检测限流是否能在多实例下正常工作）
    try {
        await registerInstance();

        process.on('SIGTERM', async () => {
            await unregisterInstance();
        });
        process.on('SIGINT', async () => {
            await unregisterInstance();
        });
    } catch (e) {
        console.warn('[init] Instance check registration failed:', e);
    }

    // 注册 Prisma 优雅关闭
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

    if (process.env.NODE_ENV === 'production') {
        console.log('[init] Starting avatar queue processor...');
        // 启动后台队列处理器，每 2 秒检查一次
        startAvatarQueueProcessor(2000);
    } else {
        console.log('[init] Skipping avatar queue processor in development');
    }
}
