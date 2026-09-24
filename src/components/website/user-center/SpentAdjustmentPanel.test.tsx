// @vitest-environment jsdom
/**
 * 消费补录面板交互测试：必填校验 / 本地金额校验 / 提交载荷与重置 / 待审上限。
 * 仅覆盖表单视图与基础历史渲染；上传依赖 blob URL，不在 jsdom 覆盖范围。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mocks = vi.hoisted(() => ({
    fetchWithCsrf: vi.fn(),
    showError: vi.fn(),
    showSuccess: vi.fn(),
}));

vi.mock("@/lib/fetch-client", () => ({
    fetchWithCsrf: mocks.fetchWithCsrf,
}));

vi.mock("@/components/ui/Toast", () => ({
    useToast: () => ({ error: mocks.showError, success: mocks.showSuccess }),
}));

import { SpentAdjustmentPanel } from "@/components/website/user-center/SpentAdjustmentPanel";

const fetchMock = vi.fn();

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

const emptyApplications = { success: true, data: { applications: [] } };

let container: HTMLDivElement;
let root: Root;
let onViewChange: ReturnType<typeof vi.fn>;
let onRequestLogin: ReturnType<typeof vi.fn>;

async function renderPanel(
    view: "form" | "history" = "form",
    applications: unknown = emptyApplications
) {
    fetchMock.mockResolvedValue(jsonResponse(applications));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onViewChange = vi.fn();
    onRequestLogin = vi.fn();
    await act(async () => {
        root.render(
            <SpentAdjustmentPanel
                view={view}
                onViewChange={onViewChange}
                onRequestLogin={onRequestLogin}
            />
        );
    });
}

function input(selector: string): HTMLInputElement {
    const el = container.querySelector<HTMLInputElement>(selector);
    if (!el) throw new Error(`input not found: ${selector}`);
    return el;
}

function buttonByText(text: string): HTMLButtonElement {
    const el = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes(text)
    );
    if (!el) throw new Error(`button not found: ${text}`);
    return el;
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

async function click(el: Element) {
    await act(async () => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("SpentAdjustmentPanel 表单", () => {
    it("默认选中天猫渠道，空订单号提交被本地拦截", async () => {
        await renderPanel();

        const tmall = buttonByText("天猫国际");
        expect(tmall.getAttribute("aria-pressed")).toBe("true");

        await click(buttonByText("提交申请"));

        expect(mocks.showError).toHaveBeenCalledWith("请填写订单号或小票号");
        expect(mocks.fetchWithCsrf).not.toHaveBeenCalled();
    });

    it("经销渠道需先填写经销商名称", async () => {
        await renderPanel();
        await click(buttonByText("经销渠道"));
        await setValue(input("#spent-order-no"), "ORDER-1");

        await click(buttonByText("提交申请"));

        expect(mocks.showError).toHaveBeenCalledWith("请填写经销商名称");
        expect(mocks.fetchWithCsrf).not.toHaveBeenCalled();
    });

    it("金额越界在提交前本地拦截", async () => {
        await renderPanel();
        await setValue(input("#spent-order-no"), "ORDER-2");
        await setValue(input("#spent-amount"), "1000001");

        await click(buttonByText("提交申请"));

        expect(mocks.showError).toHaveBeenCalledWith("消费金额不能超过 ¥1,000,000");
        expect(mocks.fetchWithCsrf).not.toHaveBeenCalled();
    });

    it("合法提交：POST 载荷正确，成功后回主视图并清空表单", async () => {
        mocks.fetchWithCsrf.mockResolvedValue(jsonResponse({ success: true, data: {} }));
        await renderPanel();
        const orderNo = input("#spent-order-no");
        const note = input("#spent-note");
        await setValue(orderNo, "ORDER-3");
        await setValue(input("#spent-amount"), "1280");
        await setValue(note, "含两支装");

        await click(buttonByText("提交申请"));

        expect(mocks.fetchWithCsrf).toHaveBeenCalledTimes(1);
        const [url, init] = mocks.fetchWithCsrf.mock.calls[0];
        expect(url).toBe("/api/account/spent-adjustments");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({
            channel: "TMALL",
            orderNo: "ORDER-3",
            amountClaimed: 1280,
            note: "含两支装",
            images: [],
        });
        expect(mocks.showSuccess).toHaveBeenCalledWith("申请已提交，等待审核");
        expect(onViewChange).toHaveBeenCalledWith("default");
        expect(orderNo.value).toBe("");
        expect(note.value).toBe("");
    });

    it("微信小铺渠道可选择并随提交上报", async () => {
        mocks.fetchWithCsrf.mockResolvedValue(jsonResponse({ success: true, data: {} }));
        await renderPanel();
        await click(buttonByText("微信小铺"));
        expect(buttonByText("微信小铺").getAttribute("aria-pressed")).toBe("true");
        await setValue(input("#spent-order-no"), "ORDER-WX");

        await click(buttonByText("提交申请"));

        const [, init] = mocks.fetchWithCsrf.mock.calls[0];
        expect(JSON.parse(String(init.body))).toMatchObject({
            channel: "WECHAT_SHOP",
            orderNo: "ORDER-WX",
        });
    });

    it("待审申请达上限时禁用提交并提示", async () => {
        await renderPanel("form", {
            success: true,
            data: { applications: [{ status: "PENDING" }, { status: "PENDING" }] },
        });

        expect(buttonByText("提交申请").disabled).toBe(true);
        expect(container.textContent).toContain("请等待审核完成后再提交新申请");
    });

    it("录入历史展示审核状态、入账金额与驳回原因", async () => {
        await renderPanel("history", {
            success: true,
            data: {
                applications: [
                    {
                        id: "a-1",
                        channel: "TMALL",
                        orderNo: "ORDER-A",
                        dealerName: null,
                        amountClaimed: 1000,
                        purchasedAt: null,
                        images: [],
                        note: null,
                        status: "APPROVED",
                        reviewAmount: 1000,
                        reviewNote: null,
                        createdAt: "2026-09-01T10:00:00.000Z",
                        reviewedAt: null,
                    },
                    {
                        id: "a-2",
                        channel: "OFFLINE",
                        orderNo: "ORDER-B",
                        dealerName: null,
                        amountClaimed: null,
                        purchasedAt: null,
                        images: [],
                        note: null,
                        status: "REJECTED",
                        reviewAmount: null,
                        reviewNote: "凭证模糊，请重新上传",
                        createdAt: "2026-09-02T10:00:00.000Z",
                        reviewedAt: null,
                    },
                ],
            },
        });

        expect(container.textContent).toContain("已通过");
        expect(container.textContent).toContain("已入账 ¥1,000");
        expect(container.textContent).toContain("驳回原因：凭证模糊，请重新上传");
    });
});
