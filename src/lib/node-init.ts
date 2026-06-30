import { registerInstance, unregisterInstance, stopHeartbeat } from './instance-check';
import prisma from './prisma';

export async function initNode() {
    console.log('[init] Application starting...');

    // 注册实例到多实例检测表（用于检测限流是否能在多实例下正常工作）
    try {
        await registerInstance();

        process.on('SIGTERM', async () => {
            stopHeartbeat();
            await unregisterInstance();
        });
        process.on('SIGINT', async () => {
            stopHeartbeat();
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

    console.log('[init] Node initialization complete');
}
