import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["src/**/*.test.ts"],
        env: {
            JWT_SECRET: "test-jwt-secret-must-be-at-least-32-characters-long",
            ADMIN_SESSION_SECRET: "test-admin-session-secret-32-chars-long",
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
