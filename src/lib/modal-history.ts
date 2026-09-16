"use client";

/**
 * modal-history — 弹层返回键联动（history 哨兵）的协调器
 *
 * 目标（移动端 App 化体验）：弹层打开时，"返回键/返回手势"先关弹层、再退页面。
 *
 * 设计要点：
 * - **一会话一哨兵**：任何受管弹层打开期间，历史栈里最多存在一条标记记录；
 *   嵌套弹层（如 档案 → 打卡）共享同一条哨兵，返回键逐层关闭。
 * - **同 tick 交接复用**：关闭 A 的同时打开 B（如「我的」→「护肤档案」）不产生历史抖动，
 *   直接复用现有哨兵（通过微任务取消清理实现）。
 * - **程序化回退抑制**：UI 主动关闭时用 `history.back()` 清掉哨兵，
 *   由此产生的 popstate 需要吞掉，避免误关其它弹层/误判用户返回。
 * - **导航让位**：弹层打开期间发生真实页面导航（点报告链接等）时，
 *   当前条目已不是哨兵，直接放弃清理，不干扰 Next.js 路由。
 *
 * 该模块不依赖 React，可注入环境做单元测试；浏览器单例见 `getModalHistory`。
 */

export const MODAL_HISTORY_KEY = "__dockModalId";

/** 程序化 back 产生的 popstate 抑制窗口（毫秒）：兜底 back 未触发 popstate 的情况 */
const SUPPRESS_WINDOW_MS = 1500;

export interface ModalHistoryEnv {
  /** 读取当前历史条目 state */
  getState: () => Record<string, unknown> | null;
  /** pushState（url 传空串表示当前地址） */
  pushState: (state: Record<string, unknown>, url: string) => void;
  /** 历史回退 */
  back: () => void;
  /** 当前时间戳（测试注入） */
  now: () => number;
  /** 微任务调度（同 tick 交接的合并窗口） */
  schedule: (fn: () => void) => void;
}

export function createModalHistory(env: ModalHistoryEnv) {
  /** 打开中的弹层 id（后进先出，栈顶响应返回键） */
  const stack: string[] = [];
  const callbacks = new Map<string, () => void>();
  /** 历史栈中是否存在本会话的哨兵 */
  let sentinelActive = false;
  /** 本轮 close 是否在等待微任务清理（同 tick 的 open 可取消） */
  let pendingDrop = false;
  /** 最近一次程序化 back 的时间戳（抑制其 popstate） */
  let suppressedAt = 0;

  const isOurSentinelCurrent = () => {
    const state = env.getState();
    return typeof state?.[MODAL_HISTORY_KEY] === "string";
  };

  const pushSentinel = (id: string) => {
    env.pushState({ ...(env.getState() ?? {}), [MODAL_HISTORY_KEY]: id }, "");
  };

  const open = (id: string, onClose: () => void) => {
    stack.push(id);
    callbacks.set(id, onClose);

    if (pendingDrop) {
      // 同 tick 交接：取消哨兵清理，复用它（不再 push，历史栈零抖动）
      pendingDrop = false;
      return;
    }
    if (!sentinelActive) {
      pushSentinel(id);
      sentinelActive = true;
    }
  };

  const close = (id: string) => {
    const idx = stack.lastIndexOf(id);
    if (idx >= 0) stack.splice(idx, 1);
    callbacks.delete(id);

    // 还有弹层打开，或本就没有哨兵：不动历史
    if (stack.length > 0 || !sentinelActive) return;

    pendingDrop = true;
    env.schedule(() => {
      if (!pendingDrop) return; // 被同 tick 的新 open 取消
      pendingDrop = false;
      if (stack.length > 0) return;
      if (!isOurSentinelCurrent()) {
        // 弹层打开期间发生了真实导航（如点报告链接），哨兵已不在当前条目：不做任何事
        sentinelActive = false;
        return;
      }
      // 清掉哨兵：程序化回退，并吞掉随之而来的 popstate
      suppressedAt = env.now();
      sentinelActive = false;
      env.back();
    });
  };

  const handlePopState = () => {
    // 程序化回退产生的 popstate：吞掉
    if (suppressedAt && env.now() - suppressedAt < SUPPRESS_WINDOW_MS) {
      suppressedAt = 0;
      return;
    }
    if (!sentinelActive) return;

    // 用户返回键：关闭栈顶弹层（哨兵已被浏览器消费）
    const topId = stack.pop();
    if (topId) {
      const cb = callbacks.get(topId);
      callbacks.delete(topId);
      cb?.();
    }

    if (stack.length > 0) {
      // 嵌套：为剩余弹层补回哨兵，保证"返回键逐层关闭"
      pushSentinel(stack[stack.length - 1]);
    } else {
      sentinelActive = false;
    }
  };

  return { open, close, handlePopState };
}

let singleton: ReturnType<typeof createModalHistory> | null = null;

/** 浏览器单例：首次调用时绑定 popstate 监听（仅客户端 effect 中调用） */
export function getModalHistory() {
  if (!singleton) {
    singleton = createModalHistory({
      getState: () =>
        typeof window === "undefined" ? null : (window.history.state as Record<string, unknown> | null),
      pushState: (state, url) => window.history.pushState(state, "", url),
      back: () => window.history.back(),
      now: () => Date.now(),
      schedule: (fn) => queueMicrotask(fn),
    });
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", singleton.handlePopState);
    }
  }
  return singleton;
}
