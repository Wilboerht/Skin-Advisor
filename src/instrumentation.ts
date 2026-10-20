/**
 * Node.js 应用初始化
 * 在服务器启动时运行一次性的初始化任务。
 *
 * 位置注意：项目使用 src/app，Next.js 只识别 src/instrumentation.ts，
 * 根目录 instrumentation.ts 不会被 standalone 构建打包（会导致
 * AppInstance 永远为 0、registerInstance/优雅关闭不执行）。
 *
 * 此文件也会在 Edge Runtime 中被加载，因此不能直接在顶层使用
 * process.on / process.exit；Node.js 逻辑通过动态导入在 Node runtime 执行。
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "edge") {
        return;
    }

    const { initNode } = await import("@/lib/node-init");
    await initNode();
}
