import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advisorStorage } from "./advisor-storage";

const values = new Map<string, string>();
const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
};

beforeEach(() => {
    values.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T08:00:00.000Z"));
    vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("advisorStorage localStorage retention", () => {
    it("降级照片在 6 小时内可读取，过期后返回 null 并删除", async () => {
        await advisorStorage.saveFaceImages({ front: "data:image/jpeg;base64,abc" });
        await expect(advisorStorage.getFaceImages()).resolves.toEqual({ front: "data:image/jpeg;base64,abc" });

        vi.setSystemTime(new Date("2026-11-05T14:00:01.000Z"));
        await expect(advisorStorage.getFaceImages()).resolves.toBeNull();
        expect(values.has("advisor_face_images")).toBe(false);
    });

    it("无时间戳的历史照片按过期处理", async () => {
        values.set("advisor_face_images", JSON.stringify({ front: "old-photo" }));
        await expect(advisorStorage.getFaceImages()).resolves.toBeNull();
        expect(values.has("advisor_face_images")).toBe(false);
    });

    it("预处理照片使用同样的 6 小时期限", async () => {
        await advisorStorage.saveProcessedImages({ front: "processed" });
        vi.setSystemTime(new Date("2026-11-05T14:00:01.000Z"));
        await expect(advisorStorage.getProcessedImages()).resolves.toBeNull();
    });
});
