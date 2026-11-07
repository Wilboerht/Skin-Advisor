import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        env: {
            JWT_SECRET: "test-jwt-secret-must-be-at-least-32-characters-long",
            ADMIN_SESSION_SECRET: "test-admin-session-secret-32-chars-long",
            // 业务日界固定北京时间，避免 CI 在不同时区/凌晨窗口出现日期相关随机失败
            TZ: "Asia/Shanghai",
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
        },
    },
});
