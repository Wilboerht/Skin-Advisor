import { registerInstance, unregisterInstance, stopHeartbeat } from './instance-check';
import prisma from './prisma';
import { logger } from './logger';

export async function initNode() {
    logger.info('[init] Application starting...');

    // 注册实例检测（心跳 + 优雅关闭）
    try {
        await registerInstance();
    } catch (e) {
        logger.warn('[init] Instance check registration failed', { error: String(e) });
    }

    // 统一的优雅关闭处理（合并为单个 handler，避免竞态）
    const gracefulShutdown = async (signal: string) => {
        logger.info(`[init] ${signal} received, shutting down gracefully...`);
        try {
            stopHeartbeat();
            await unregisterInstance();
        } catch (e) {
            logger.warn('[init] Instance unregister failed', { error: String(e) });
        }
        try {
            await prisma.$disconnect();
            logger.info('[init] Prisma disconnected');
        } catch (e) {
            logger.warn('[init] Prisma disconnect failed', { error: String(e) });
        }
        process.exit(0);
    };

    process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
    process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });

    logger.info('[init] Node initialization complete');
}
