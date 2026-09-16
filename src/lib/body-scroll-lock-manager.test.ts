import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * body-scroll-lock-manager 的单元测试（node 环境 + 最小 DOM stub）。
 * 核心回归场景：唯一一把锁是 iosSafe 锁时，释放后 body 必须还原
 * position/width/top，否则整页冻结无法滚动（skin-types 移动端事故）。
 */

interface DomStub {
    style: Record<string, string>;
    attrs: Set<string>;
    scrollTo: ReturnType<typeof vi.fn>;
}

function installDomStub(scrollY = 300): DomStub {
    const stub: DomStub = {
        style: { overflow: "", position: "", width: "", top: "" },
        attrs: new Set<string>(),
        scrollTo: vi.fn(),
    };
    (globalThis as Record<string, unknown>).document = {
        body: {
            style: stub.style,
            setAttribute: (name: string) => stub.attrs.add(name),
            removeAttribute: (name: string) => stub.attrs.delete(name),
        },
    };
    (globalThis as Record<string, unknown>).window = {
        scrollY,
        scrollTo: stub.scrollTo,
    };
    return stub;
}

async function importManager() {
    // 每个用例重新加载模块，重置模块级锁计数
    vi.resetModules();
    return import("./body-scroll-lock-manager");
}

beforeEach(() => {
    installDomStub(300);
});

afterEach(() => {
    delete (globalThis as Record<string, unknown>).document;
    delete (globalThis as Record<string, unknown>).window;
});

describe("body-scroll-lock-manager", () => {
    it("普通锁：加锁隐藏 overflow，解锁完整还原", async () => {
        const { acquireLock, releaseLock } = await importManager();
        const { style, attrs, scrollTo } = installDomStub(0);

        acquireLock(false);
        expect(style.overflow).toBe("hidden");
        expect(attrs.has("data-scroll-locked")).toBe(true);
        expect(style.position).toBe("");

        releaseLock(false);
        expect(style.overflow).toBe("");
        expect(attrs.has("data-scroll-locked")).toBe(false);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("回归：唯一一把锁是 iosSafe 锁时，释放后 position:fixed 必须还原（否则整页冻结）", async () => {
        const { acquireLock, releaseLock } = await importManager();
        const { style, attrs, scrollTo } = installDomStub(300);

        acquireLock(true);
        expect(style.overflow).toBe("hidden");
        expect(style.position).toBe("fixed");
        expect(style.top).toBe("-300px");
        expect(style.width).toBe("100%");

        releaseLock(true);
        expect(style.position).toBe("");
        expect(style.top).toBe("");
        expect(style.width).toBe("");
        expect(style.overflow).toBe("");
        expect(attrs.has("data-scroll-locked")).toBe(false);
        expect(scrollTo).toHaveBeenCalledWith(0, 300);
    });

    it("iosSafe 锁 + 普通锁交错：先释放 ios 锁时移除 fixed 但保留 overflow 锁定", async () => {
        const { acquireLock, releaseLock } = await importManager();
        const { style, attrs } = installDomStub(120);

        acquireLock(true); // 弹窗（iOS fixed）
        acquireLock(false); // 页面常驻锁
        expect(style.position).toBe("fixed");

        releaseLock(true); // 关闭弹窗
        expect(style.position).toBe("");
        expect(style.top).toBe("");
        expect(style.overflow).toBe("hidden"); // 页面锁仍在，overflow 保持
        expect(attrs.has("data-scroll-locked")).toBe(true);

        releaseLock(false); // 页面锁释放
        expect(style.overflow).toBe("");
        expect(attrs.has("data-scroll-locked")).toBe(false);
    });

    it("两把 iosSafe 锁：第一把释放不移除 fixed，最后一把释放才还原", async () => {
        const { acquireLock, releaseLock } = await importManager();
        const { style } = installDomStub(50);

        acquireLock(true);
        acquireLock(true);
        expect(style.position).toBe("fixed");

        releaseLock(true);
        expect(style.position).toBe("fixed"); // 仍有一把 ios 锁存活
        expect(style.overflow).toBe("hidden");

        releaseLock(true);
        expect(style.position).toBe("");
        expect(style.overflow).toBe("");
    });

    it("未加锁时释放是安全空操作", async () => {
        const { releaseLock } = await importManager();
        const { style } = installDomStub(0);

        expect(() => releaseLock(true)).not.toThrow();
        expect(() => releaseLock(false)).not.toThrow();
        expect(style.overflow).toBe("");
        expect(style.position).toBe("");
    });
});
