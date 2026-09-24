import { describe, it, expect } from "vitest";
import {
    MAX_AMOUNT,
    MAX_ORDER_NO_LENGTH,
    SPENT_CHANNEL_LABELS,
    SPENT_CHANNELS,
    validateSpentDraft,
    receiptImageSrc,
    type SpentDraftInput,
} from "./spent-adjustments";

const base: SpentDraftInput = {
    channel: "TMALL",
    orderNo: "ORDER-1",
    dealerName: "",
    amountClaimed: "",
};

describe("validateSpentDraft", () => {
    it("订单号必填（含纯空白）", () => {
        expect(validateSpentDraft({ ...base, orderNo: "" })).toMatch(/订单号/);
        expect(validateSpentDraft({ ...base, orderNo: "   " })).toMatch(/订单号/);
    });

    it("订单号超长拦截", () => {
        const tooLong = "x".repeat(MAX_ORDER_NO_LENGTH + 1);
        expect(validateSpentDraft({ ...base, orderNo: tooLong })).toMatch(/订单号/);
        expect(validateSpentDraft({ ...base, orderNo: "x".repeat(MAX_ORDER_NO_LENGTH) })).toBeNull();
    });

    it("经销渠道必须填写经销商名称", () => {
        expect(validateSpentDraft({ ...base, channel: "DEALER" })).toMatch(/经销商/);
        expect(validateSpentDraft({ ...base, channel: "DEALER", dealerName: "  " })).toMatch(/经销商/);
        expect(
            validateSpentDraft({ ...base, channel: "DEALER", dealerName: "XX 美妆集合店" })
        ).toBeNull();
    });

    it("金额选填：空值直接通过", () => {
        expect(validateSpentDraft(base)).toBeNull();
    });

    it("金额低于下限 / 高于上限 / 非数字拦截", () => {
        expect(validateSpentDraft({ ...base, amountClaimed: "0" })).toMatch(/小于/);
        expect(validateSpentDraft({ ...base, amountClaimed: "-1" })).toMatch(/小于/);
        expect(validateSpentDraft({ ...base, amountClaimed: String(MAX_AMOUNT + 1) })).toMatch(/超过/);
        expect(validateSpentDraft({ ...base, amountClaimed: "abc" })).toMatch(/格式/);
    });

    it("金额边界与小数通过", () => {
        expect(validateSpentDraft({ ...base, amountClaimed: "1" })).toBeNull();
        expect(validateSpentDraft({ ...base, amountClaimed: "1280.5" })).toBeNull();
        expect(validateSpentDraft({ ...base, amountClaimed: String(MAX_AMOUNT) })).toBeNull();
    });
});

describe("渠道白名单", () => {
    it("包含微信小铺（WECHAT_SHOP）且展示文案与官网一致", () => {
        expect(SPENT_CHANNELS).toContain("WECHAT_SHOP");
        expect(SPENT_CHANNEL_LABELS.WECHAT_SHOP).toBe("微信小铺");
    });

    it("按业务顺序排列：小红书之后、线下专柜之前", () => {
        expect(SPENT_CHANNELS.indexOf("WECHAT_SHOP")).toBe(
            SPENT_CHANNELS.indexOf("XIAOHONGSHU") + 1
        );
        expect(SPENT_CHANNELS.indexOf("OFFLINE")).toBe(
            SPENT_CHANNELS.indexOf("WECHAT_SHOP") + 1
        );
    });
});

describe("receiptImageSrc", () => {
    it("绝对 URL 原样返回", () => {
        expect(receiptImageSrc("https://cdn.example.com/a.jpg")).toBe(
            "https://cdn.example.com/a.jpg"
        );
    });

    it("官网本地存储相对路径补全官网 origin", () => {
        expect(receiptImageSrc("/uploads/a.jpg")).toMatch(/^https?:\/\/.+\/uploads\/a\.jpg$/);
    });

    it("私有 objectName 走子站 BFF 签名端点", () => {
        expect(receiptImageSrc("spent-adjustments/a.webp")).toBe(
            "/api/account/spent-adjustments/image?key=spent-adjustments%2Fa.webp"
        );
    });
});
