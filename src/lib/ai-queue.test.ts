import { describe, expect, it, vi } from "vitest";
import { AIRequestQueue } from "./ai-queue";

describe("AIRequestQueue acquire cancellation", () => {
    it("取消排队请求后立即移除任务并释放后续槽位", async () => {
        const queue = new AIRequestQueue(1, 1, 10);
        await queue.acquire({ userId: "first" });

        const controller = new AbortController();
        const pending = queue.acquire({ signal: controller.signal, userId: "second" });
        expect(queue.getStats().queueLength).toBe(1);
        controller.abort();
        await expect(pending).rejects.toThrow("aborted");
        expect(queue.getStats().queueLength).toBe(0);

        queue.release();
        await expect(queue.acquire({ userId: "third" })).resolves.toBeUndefined();
        expect(queue.getStats().runningCount).toBe(1);
        queue.release();
        await vi.waitFor(() => expect(queue.getStats().runningCount).toBe(0));
    });

    it("排队超时不会留下已失效任务", async () => {
        const queue = new AIRequestQueue(1, 1, 10);
        await queue.acquire();
        const pending = queue.acquire({ timeoutMs: 10 });
        await expect(pending).rejects.toThrow("timed out");
        expect(queue.getStats().queueLength).toBe(0);

        queue.release();
        await expect(queue.acquire()).resolves.toBeUndefined();
        queue.release();
    });
});
