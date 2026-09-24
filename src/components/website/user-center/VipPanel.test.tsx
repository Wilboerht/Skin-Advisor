// @vitest-environment jsdom
/**
 * 会员中心消费补录视图切换回归测试：
 * 补录面板常驻挂载，返回主视图再进入时草稿保留、且不重复拉取申请列表。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mocks = vi.hoisted(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    refresh: vi.fn(),
    user: { membershipLevel: "REGULAR" },
}));

vi.mock("@/components/ui/Toast", () => ({
    useToast: () => ({ error: mocks.showError, success: mocks.showSuccess }),
}));

// user/refresh 保持稳定引用：VipPanel 的加载 useCallback 依赖它们，否则会无限重拉
vi.mock("@/hooks/useAuth", () => ({
    useAuth: () => ({ user: mocks.user, refresh: mocks.refresh }),
}));

vi.mock("next/image", () => ({
    default: "img",
}));

// framer-motion 在 jsdom 中的退出动画无法稳定结束，mock 为透传标签：
// AnimatePresence 子级清空后同步触发 onExitComplete，保留「先出后进」的揭示时序
vi.mock("framer-motion", async () => {
    const React = await import("react");
    const motionProps = new Set(["initial", "animate", "exit", "transition", "layoutId"]);
    const passthrough = (tag: string) =>
        function MotionMock(props: Record<string, unknown>) {
            const rest: Record<string, unknown> = {};
            for (const key of Object.keys(props)) {
                if (!motionProps.has(key)) rest[key] = props[key];
            }
            return React.createElement(tag, rest, props.children as React.ReactNode);
        };
    function AnimatePresence({
        children,
        onExitComplete,
    }: {
        children?: React.ReactNode;
        onExitComplete?: () => void;
    }) {
        const hasChildren = React.Children.toArray(children).some((child) =>
            React.isValidElement(child)
        );
        React.useEffect(() => {
            if (!hasChildren) onExitComplete?.();
        }, [hasChildren, onExitComplete]);
        return React.createElement(React.Fragment, null, children);
    }
    return {
        AnimatePresence,
        m: { div: passthrough("div"), span: passthrough("span") },
    };
});

import { VipPanel } from "@/components/website/user-center/VipPanel";

const fetchMock = vi.fn();

const membership = {
    membershipLevel: "REGULAR",
    memberId: "10001",
    totalSpent: 0,
    currentLevel: {
        level: "REGULAR",
        name: "普通会员",
        minSpent: 0,
        benefits: [{ title: "测肤体验", desc: "每日基础测肤" }],
    },
    nextLevel: { name: "银卡会员", spentNeeded: 1000, progress: 0 },
    allLevels: [],
};

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function mockApi() {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/account/spent-adjustments")) {
            return Promise.resolve(jsonResponse({ success: true, data: { applications: [] } }));
        }
        if (url.includes("/api/account/membership")) {
            return Promise.resolve(jsonResponse(membership));
        }
        if (url.includes("/api/account/points")) {
            return Promise.resolve(jsonResponse({ success: true, data: { available: 100 } }));
        }
        if (url.includes("/api/advisor/test-limit")) {
            return Promise.resolve(
                jsonResponse({
                    level: "REGULAR",
                    usage: { totalUsed: 0, todayUsed: 0, lifetimeLimit: 3, dailyLimit: 1 },
                })
            );
        }
        return Promise.resolve(jsonResponse({ success: false }, 404));
    });
}

let container: HTMLDivElement;
let root: Root;

async function renderVip() {
    mockApi();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(<VipPanel onRequestLogin={vi.fn()} onNavigateMall={vi.fn()} />);
    });
}

function buttonByText(text: string): HTMLButtonElement {
    const el = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(text)
    );
    if (!el) throw new Error(`button not found: ${text}`);
    return el;
}

function orderNoInput(): HTMLInputElement {
    const el = container.querySelector<HTMLInputElement>("#spent-order-no");
    if (!el) throw new Error("order no input not rendered");
    return el;
}

function spentFetchCount(): number {
    return fetchMock.mock.calls.filter(([u]) =>
        String(u).includes("/api/account/spent-adjustments")
    ).length;
}

async function waitFor(assertion: () => void, timeoutMs = 3000) {
    const startedAt = Date.now();
    for (;;) {
        try {
            assertion();
            return;
        } catch (err) {
            if (Date.now() - startedAt > timeoutMs) throw err;
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 25));
            });
        }
    }
}

async function click(el: Element) {
    await act(async () => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

async function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto =
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    await act(async () => {
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
});

describe("VipPanel 消费补录视图切换", () => {
    it("返回主视图后再进表单，草稿保留且不重复拉取申请列表", async () => {
        await renderVip();
        await waitFor(() => {
            expect(container.textContent).toContain("录入消费");
        });
        expect(spentFetchCount()).toBe(0);

        await click(buttonByText("录入消费"));
        await waitFor(() => {
            expect(orderNoInput().closest("[hidden]")).toBeNull();
        });
        expect(spentFetchCount()).toBe(1);

        const orderNo = orderNoInput();
        const note = container.querySelector<HTMLTextAreaElement>("#spent-note")!;
        await setValue(orderNo, "ORDER-DRAFT");
        await setValue(note, "草稿备注");

        // 返回主视图：面板进入 default 空态（组件仍常驻，草稿在 state 中保留）
        await click(buttonByText("返回"));
        await waitFor(() => {
            expect(container.querySelector("#spent-order-no")).toBeNull();
            expect(container.textContent).toContain("录入消费");
        });

        await click(buttonByText("录入消费"));
        await waitFor(() => {
            expect(orderNoInput().closest("[hidden]")).toBeNull();
        });

        expect(orderNoInput().value).toBe("ORDER-DRAFT");
        expect(container.querySelector<HTMLTextAreaElement>("#spent-note")!.value).toBe("草稿备注");
        expect(spentFetchCount()).toBe(1);
    });
});
