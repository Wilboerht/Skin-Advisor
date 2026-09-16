import { describe, expect, it, vi } from "vitest";
import { createFaceModelStore, type FaceApiLike, type FaceModelNet } from "./face-models";

/** 假 net：可控失败次数与加载调用计数 */
interface FakeNet extends FaceModelNet {
  readonly calls: number;
}

function makeFakeNet(failures = 0): FakeNet {
  let remainingFailures = failures;
  let calls = 0;
  let loaded = false;
  return {
    get calls() {
      return calls;
    },
    get isLoaded() {
      return loaded;
    },
    async loadFromUri() {
      calls += 1;
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        throw new Error("model fetch failed");
      }
      loaded = true;
    },
  };
}

function makeFakeApi(tinyFailures = 0, landmarkFailures = 0) {
  return {
    nets: {
      tinyFaceDetector: makeFakeNet(tinyFailures),
      faceLandmark68Net: makeFakeNet(landmarkFailures),
    },
  } satisfies FaceApiLike as FaceApiLike & {
    nets: { tinyFaceDetector: FakeNet; faceLandmark68Net: FakeNet };
  };
}

describe("createFaceModelStore", () => {
  it("并发调用单飞：loader 与各 net 只加载一次", async () => {
    const api = makeFakeApi();
    const loader = vi.fn(async () => api);
    const store = createFaceModelStore(loader);

    const [a, b] = await Promise.all([store.load(), store.load()]);

    expect(a).toBe(api);
    expect(b).toBe(api);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(api.nets.tinyFaceDetector.calls).toBe(1);
    expect(api.nets.faceLandmark68Net.calls).toBe(1);
    expect(store.getStatus()).toBe("ready");
  });

  it("状态订阅按 loading → ready 单调推进", async () => {
    const api = makeFakeApi();
    const store = createFaceModelStore(async () => api);

    const seen: string[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getStatus()));

    await store.load();
    unsubscribe();

    expect(seen).toEqual(["loading", "ready"]);
  });

  it("失败不缓存：状态置 failed，重试只补加载缺失的 net", async () => {
    const api = makeFakeApi(1, 0); // tinyFaceDetector 第一次失败，landmark 第一次成功
    const store = createFaceModelStore(async () => api);

    await expect(store.load()).rejects.toThrow();
    expect(store.getStatus()).toBe("failed");

    const mod = await store.load();

    expect(mod).toBe(api);
    expect(store.getStatus()).toBe("ready");
    expect(api.nets.tinyFaceDetector.calls).toBe(2); // 失败一次 + 重试一次
    expect(api.nets.faceLandmark68Net.calls).toBe(1); // 已就绪，不重复加载
  });

  it("ready 后短路：不再调用 loader 与 net", async () => {
    const api = makeFakeApi();
    const loader = vi.fn(async () => api);
    const store = createFaceModelStore(loader);

    await store.load();
    await store.load();
    await store.load();

    expect(loader).toHaveBeenCalledTimes(1);
    expect(api.nets.tinyFaceDetector.calls).toBe(1);
    expect(api.nets.faceLandmark68Net.calls).toBe(1);
  });

  it("失败后 getStatus 不会因已部分加载而误报 ready", async () => {
    const api = makeFakeApi(0, 1); // 只有 landmark 失败
    const store = createFaceModelStore(async () => api);

    await expect(store.load()).rejects.toThrow();

    expect(store.getStatus()).toBe("failed");
    expect(store.getApi()).toBe(api); // 模块引用可复用，但状态必须仍是 failed
  });
});
