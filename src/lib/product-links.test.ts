import { describe, expect, it } from "vitest";
import {
    affiliateLinksSchema,
    MAX_AFFILIATE_URL_LENGTH,
    MAX_PURCHASE_URL_LENGTH,
    purchaseLinksSchema,
} from "@/types/product";
import {
    buildAffiliateLinks,
    normalizeProductPurchaseLinks,
} from "./product-links";

describe("normalizeProductPurchaseLinks", () => {
    it("keeps the four canonical channels and trims values", () => {
        const links = normalizeProductPurchaseLinks(
            [
                {
                    platformKey: "tmall",
                    platform: " 天猫国际 ",
                    url: " https://tmall.example/item ",
                },
                {
                    platformKey: "wechat-shop",
                    platform: "微信小店",
                    miniProgramShortLink: " #微信小店://NIHPLOD/demo ",
                },
            ],
            null
        );

        expect(links).toHaveLength(2);
        expect(links[0]).toMatchObject({
            platformKey: "tmall",
            platform: "天猫国际",
            url: "https://tmall.example/item",
        });
        expect(links[1]).toMatchObject({
            platformKey: "wechat-shop",
            miniProgramShortLink: "#微信小店://NIHPLOD/demo",
        });
    });

    it("drops unknown and duplicate platform keys", () => {
        const links = normalizeProductPurchaseLinks(
            [
                { platformKey: "tmall", url: "https://tmall.example/1" },
                { platformKey: "tmall", url: "https://tmall.example/2" },
                { platformKey: "jd", url: "https://jd.example" },
            ],
            null
        );

        expect(links).toEqual([
            expect.objectContaining({
                platformKey: "tmall",
                url: "https://tmall.example/1",
            }),
        ]);
    });

    it("falls back to legacy affiliateLinks when purchaseLinks is missing", () => {
        const links = normalizeProductPurchaseLinks(null, {
            taobao: "https://taobao.example/item",
            xiaohongshu: "https://xhs.example/item",
            douyin: "",
        });

        expect(links.map((link) => link.platformKey)).toEqual([
            "tmall",
            "xiaohongshu",
        ]);
    });

    it("merges missing legacy channels into partial purchaseLinks", () => {
        const links = normalizeProductPurchaseLinks(
            [{ platformKey: "wechat-shop", miniProgramShortLink: "#wx://demo" }],
            {
                taobao: "https://tmall.example/item",
                xiaohongshu: "https://xhs.example/item",
            }
        );

        expect(links.map((link) => link.platformKey)).toEqual([
            "wechat-shop",
            "tmall",
            "xiaohongshu",
        ]);
    });

    it("drops non-http URLs and can fill them from legacy data", () => {
        const links = normalizeProductPurchaseLinks(
            [{ platformKey: "tmall", url: "javascript:alert(1)" }],
            { taobao: "https://tmall.example/safe" }
        );

        expect(links[0].url).toBe("https://tmall.example/safe");
    });
});

describe("buildAffiliateLinks", () => {
    it("derives legacy links from the new structure", () => {
        expect(
            buildAffiliateLinks([
                { platformKey: "tmall", platform: "天猫国际", url: "https://tmall.example" },
                { platformKey: "xiaohongshu", platform: "小红书", url: "https://xhs.example" },
                { platformKey: "douyin", platform: "抖音", url: "https://douyin.example" },
                { platformKey: "wechat-shop", platform: "微信小店" },
            ])
        ).toEqual({
            taobao: "https://tmall.example",
            xiaohongshu: "https://xhs.example",
            douyin: "https://douyin.example",
        });
    });

    it("returns null when no legacy-compatible URL exists", () => {
        expect(
            buildAffiliateLinks([
                { platformKey: "wechat-shop", platform: "微信小店" },
            ])
        ).toBeNull();
    });
});

describe("purchase URL limits", () => {
    it("keeps the legacy affiliate URL limit aligned with purchaseLinks", () => {
        expect(MAX_AFFILIATE_URL_LENGTH).toBe(MAX_PURCHASE_URL_LENGTH);
    });

    it("accepts a max-length legacy URL instead of rejecting a derived purchase link", () => {
        const prefix = "https://e.co/";
        const url = prefix + "a".repeat(MAX_PURCHASE_URL_LENGTH - prefix.length);
        expect(url).toHaveLength(MAX_PURCHASE_URL_LENGTH);
        expect(affiliateLinksSchema.safeParse({ taobao: url }).success).toBe(true);
    });
});

describe("purchaseLinksSchema", () => {
    it("accepts a WeChat Shop shortLink without appid/product id", () => {
        const result = purchaseLinksSchema.safeParse([
            {
                platformKey: "wechat-shop",
                platform: "微信小店",
                miniProgramShortLink: "#微信小店://NIHPLOD/0o5UNfDc1oteiTB",
            },
        ]);

        expect(result.success).toBe(true);
    });

    it("allows future mini program short links for the other channels", () => {
        const result = purchaseLinksSchema.safeParse([
            {
                platformKey: "tmall",
                platform: "天猫国际",
                miniProgramShortLink: "#小程序://天猫国际/demo",
            },
        ]);

        expect(result.success).toBe(true);
    });

    it("rejects a WeChat Shop URL-only entry until H5/store-product is supported", () => {
        const result = purchaseLinksSchema.safeParse([
            {
                platformKey: "wechat-shop",
                url: "https://shop.example/item",
            },
        ]);

        expect(result.success).toBe(false);
    });
});
