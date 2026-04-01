/**
 * Node.js 应用初始化
 * 在服务器启动时运行一次性的初始化任务
 */

import { startAvatarQueueProcessor } from '@/lib/avatar-queue-processor';

export async function register() {
    console.log('[init] Application starting...');
    
    if (process.env.NODE_ENV === 'production') {
        console.log('[init] Starting avatar queue processor...');
        // 启动后台队列处理器，每 2 秒检查一次
        startAvatarQueueProcessor(2000);
    } else {
        console.log('[init] Skipping avatar queue processor in development');
    }
}
