import { describe, expect, it, vi } from "vitest";
import { createModalHistory, MODAL_HISTORY_KEY, type ModalHistoryEnv } from "./modal-history";

function createFakeEnv() {
  let state: Record<string, unknown> | null = { url: "home" };
  const pushed: Record<string, unknown>[] = [];
  let backCount = 0;
  let nowMs = 0;
  const scheduled: (() => void)[] = [];
  const guardCalls: boolean[] = [];
  const timeouts: (() => void)[] = [];

  const env: ModalHistoryEnv = {
    getState: () => state,
    pushState: (s) => {
      state = s;
      pushed.push(s);
    },
    back: () => {
      backCount += 1;
      state = { url: "prev" };
    },
    now: () => nowMs,
    schedule: (fn) => {
      scheduled.push(fn);
    },
    setViewTransitionGuard: (on) => {
      guardCalls.push(on);
    },
    setTimeout: (fn) => {
      timeouts.push(fn);
      return () => {
        const i = timeouts.indexOf(fn);
        if (i >= 0) timeouts.splice(i, 1);
      };
    },
  };

  return {
    env,
    pushed,
    guardCalls,
    get backCount() {
      return backCount;
    },
    flush: () => {
      while (scheduled.length) scheduled.shift()!();
    },
    flushTimeouts: () => {
      while (timeouts.length) timeouts.shift()!();
    },
    setNow: (v: number) => {
      nowMs = v;
    },
    setState: (s: Record<string, unknown> | null) => {
      state = s;
    },
  };
}

describe("createModalHistory", () => {
  it("打开压入哨兵；UI 关闭回退一次并吞掉程序化 popstate", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onClose = vi.fn();

    h.open("a", onClose);
    expect(f.pushed).toHaveLength(1);
    expect(f.pushed[0][MODAL_HISTORY_KEY]).toBe("a");

    h.close("a");
    expect(f.backCount).toBe(0); // 等待微任务（同 tick 交接窗口）
    f.flush();
    expect(f.backCount).toBe(1);

    h.handlePopState(); // 程序化 back 产生的 popstate 应被吞掉
    expect(onClose).not.toHaveBeenCalled();
  });

  it("返回键关闭栈顶弹层；栈空后返回键不再触发", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onClose = vi.fn();

    h.open("a", onClose);
    h.handlePopState();

    expect(onClose).toHaveBeenCalledTimes(1);

    h.handlePopState(); // 栈空，无副作用
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("嵌套弹层共享哨兵：返回键逐层关闭并补哨兵", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    h.open("a", onCloseA);
    h.open("b", onCloseB);
    expect(f.pushed).toHaveLength(1); // 一会话一哨兵

    h.handlePopState(); // 关最上层（b）
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
    expect(f.pushed).toHaveLength(2); // 为剩余层补回哨兵

    h.handlePopState(); // 再关（a）
    expect(onCloseA).toHaveBeenCalledTimes(1);
  });

  it("同 tick 交接（关 A 同时开 B）复用哨兵，无历史抖动", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    h.open("a", onCloseA);
    h.close("a");
    h.open("b", onCloseB);

    f.flush();
    expect(f.backCount).toBe(0); // 哨兵被接管，未回退
    expect(f.pushed).toHaveLength(1);

    h.handlePopState();
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
  });

  it("弹层打开期间发生真实导航：关闭时不回退历史", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onClose = vi.fn();

    h.open("a", onClose);
    f.setState({ url: "reports" }); // 模拟 Next 导航后的当前条目
    h.close("a");
    f.flush();

    expect(f.backCount).toBe(0);
  });

  it("抑制窗口过期后，新一轮会话仍正常响应返回键", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);
    const onCloseA = vi.fn();
    const onCloseC = vi.fn();

    f.setNow(1000);
    h.open("a", onCloseA);
    h.close("a");
    f.flush();
    expect(f.backCount).toBe(1);

    f.setNow(1000 + 2000); // 抑制窗口过期
    h.open("c", onCloseC);
    h.handlePopState();

    expect(onCloseC).toHaveBeenCalledTimes(1);
  });

  it("受管弹层打开期间屏蔽 View Transition，关闭并吞掉 popstate 后恢复", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);

    h.open("a", vi.fn());
    expect(f.guardCalls).toEqual([true]);

    h.close("a");
    f.flush();
    expect(f.backCount).toBe(1);
    expect(f.guardCalls).toEqual([true]); // popstate 到达前保持屏蔽

    h.handlePopState();
    expect(f.guardCalls).toEqual([true, false]);
  });

  it("嵌套返回：屏蔽保持到栈空才恢复", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);

    h.open("a", vi.fn());
    h.open("b", vi.fn());
    expect(f.guardCalls).toEqual([true]);

    h.handlePopState(); // 关 b，仍有 a
    expect(f.guardCalls).toEqual([true]);

    h.handlePopState(); // 关 a，栈空
    expect(f.guardCalls).toEqual([true, false]);
  });

  it("导航让位关闭：恢复屏蔽且不回退历史", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);

    h.open("a", vi.fn());
    f.setState({ url: "reports" });
    h.close("a");
    f.flush();

    expect(f.backCount).toBe(0);
    expect(f.guardCalls).toEqual([true, false]);
  });

  it("程序化回退后 popstate 未到达：兜底定时器恢复屏蔽", () => {
    const f = createFakeEnv();
    const h = createModalHistory(f.env);

    h.open("a", vi.fn());
    h.close("a");
    f.flush();
    expect(f.guardCalls).toEqual([true]);

    f.flushTimeouts();
    expect(f.guardCalls).toEqual([true, false]);
  });
});
