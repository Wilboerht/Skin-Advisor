/**
 * Node.js 应用初始化
 * 在服务器启动时运行一次性的初始化任务
 *
 * 注意：此文件会被 Next.js 在 Edge Runtime 中也加载，因此不能直接在顶层
 * 使用 Node.js 特有 API（如 process.on / process.exit）。所有 Node.js 逻辑
 * 都已抽离到 node-init.ts 中，通过动态导入在 Node.js runtime 下执行。
 */

export async function register() {
    // 严格跳过 Edge Runtime：instrumentation hook 在 Edge Runtime 中也会被调用
    if (process.env.NEXT_RUNTIME === 'edge') {
        return;
    }

    // 动态导入 Node.js 特有的初始化逻辑，避免 Turbopack 在编译期扫描到
    // process.on / process.exit 等 Edge Runtime 不支持的 API
    const { initNode } = await import('@/lib/node-init');
    await initNode();
}
