import { z } from "zod";

// ==================== 长度/数量限制常量 ====================

export const MAX_NAME_LENGTH = 200;
export const MAX_CATEGORY_LENGTH = 100;
export const MAX_PRICE_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_HOW_TO_USE_LENGTH = 2000;
export const MAX_IMAGE_URL_LENGTH = 500;
export const MAX_AFFILIATE_URL_LENGTH = 500;
export const MAX_IMAGE_COUNT = 5;
export const MAX_TAG_ITEM_LENGTH = 100;
export const MAX_TAG_ARRAY_LENGTH = 50;

// ==================== 业务常量 ====================

export const AFFILIATE_PLATFORM_KEYS = ["taobao", "xiaohongshu", "douyin"] as const;

export type AffiliatePlatformKey = (typeof AFFILIATE_PLATFORM_KEYS)[number];

export const CATEGORY_OPTIONS = [
    { value: "精华露", label: "精华露" },
    { value: "面霜", label: "面霜" },
    { value: "洁面", label: "洁面" },
    { value: "护理油", label: "护理油" },
    { value: "面膜", label: "面膜" },
    { value: "身体乳", label: "身体乳" },
    { value: "防晒", label: "防晒" },
    { value: "磨砂膏", label: "磨砂膏" },
    { value: "护手霜", label: "护手霜" },
] as const;

export type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

export interface CategoryOption {
    value: CategoryValue;
    label: string;
}

export const SKIN_TYPE_OPTIONS = [
    { value: "dry", label: "干性肌肤", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "oily", label: "油性肌肤", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "combination", label: "混合性肌肤", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { value: "combination_dry", label: "混干性肌肤", color: "bg-teal-50 text-teal-700 border-teal-200" },
    { value: "combination_oily", label: "混油性肌肤", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { value: "sensitive", label: "敏感肌肤", color: "bg-rose-50 text-rose-700 border-rose-200" },
    { value: "normal", label: "中性肌肤", color: "bg-slate-50 text-slate-700 border-slate-200" },
] as const;

export type SkinTypeValue = (typeof SKIN_TYPE_OPTIONS)[number]["value"];

export interface SkinTypeOption {
    value: SkinTypeValue;
    label: string;
    color: string;
}

// ==================== Zod Schemas ====================

const nonEmptyString = (max: number) =>
    z.string().min(1, { message: "不能为空" }).max(max, { message: `最多 ${max} 个字符` });

const optionalNullableString = (max: number) =>
    z.union([z.string().max(max), z.null()]).optional();

const imageUrlSchema = z
    .string()
    .max(MAX_IMAGE_URL_LENGTH)
    .refine(
        (val) => /^https?:\/\//.test(val) || val.startsWith("/"),
        { message: "图片 URL 必须是 http(s) 绝对地址或以 / 开头的相对路径" }
    );

const stringArraySchema = z
    .array(z.string().max(MAX_TAG_ITEM_LENGTH))
    .max(MAX_TAG_ARRAY_LENGTH)
    .default([]);

export const affiliateLinksSchema = z
    .record(
        z.string(),
        z.string().max(MAX_AFFILIATE_URL_LENGTH).refine(
            (val) => {
                if (!val) return true;
                try {
                    const url = new URL(val);
                    return url.protocol === "http:" || url.protocol === "https:";
                } catch {
                    return false;
                }
            },
            { message: "必须是有效的 http(s) URL" }
        )
    )
    .refine(
        (record) => Object.keys(record).every((k) => AFFILIATE_PLATFORM_KEYS.includes(k as AffiliatePlatformKey)),
        { message: `affiliateLinks 只允许以下 key: ${AFFILIATE_PLATFORM_KEYS.join(", ")}` }
    )
    .nullable()
    .default(null);

export const productJsonFieldsSchema = z.object({
    keyIngredients: stringArraySchema,
    suitableSkinTypes: stringArraySchema,
    benefits: stringArraySchema,
    negativeFor: stringArraySchema,
});

export const productSchema = z.object({
    id: z.string().cuid(),
    name: nonEmptyString(MAX_NAME_LENGTH),
    category: nonEmptyString(MAX_CATEGORY_LENGTH),
    image: imageUrlSchema,
    images: z.array(imageUrlSchema).max(MAX_IMAGE_COUNT).nullable().default(null),
    price: nonEmptyString(MAX_PRICE_LENGTH),
    description: nonEmptyString(MAX_DESCRIPTION_LENGTH),
    howToUse: optionalNullableString(MAX_HOW_TO_USE_LENGTH),
    keyIngredients: stringArraySchema,
    suitableSkinTypes: stringArraySchema,
    benefits: stringArraySchema,
    negativeFor: stringArraySchema,
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    affiliateLinks: affiliateLinksSchema,
    createdAt: z.union([z.string().datetime(), z.date()]).optional(),
    updatedAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export const serializedProductSchema = productSchema.omit({ createdAt: true, updatedAt: true }).extend({
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const productFormDataSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    price: z.string().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).max(MAX_IMAGE_COUNT).nullable().optional(),
    description: z.string().nullable().optional(),
    howToUse: z.string().nullable().optional(),
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
    keyIngredients: z.array(z.string()).nullable().optional(),
    benefits: z.array(z.string()).nullable().optional(),
    negativeFor: z.array(z.string()).nullable().optional(),
    suitableSkinTypes: z.array(z.string()).nullable().optional(),
    affiliateLinks: z.record(z.string(), z.string()).nullable().optional(),
});

// ==================== TypeScript Types ====================

export type Product = z.infer<typeof productSchema>;
export type SerializedProduct = z.infer<typeof serializedProductSchema>;
export type ProductFormData = z.infer<typeof productFormDataSchema>;
export type AffiliateLinks = z.infer<typeof affiliateLinksSchema>;
export type ProductJsonFields = z.infer<typeof productJsonFieldsSchema>;

// ==================== 运行时归一化辅助函数 ====================

/** 将任意图片路径归一化为可用格式 */
export function normalizeImagePath(img: unknown): string {
    if (typeof img !== "string" || !img.trim()) return "";
    if (/^https?:\/\//.test(img)) return img;
    if (img.startsWith("/")) return img;
    return `/uploads/${img}`;
}

/** 将任意图片数组归一化为字符串数组 */
export function normalizeImages(images: unknown): string[] {
    if (Array.isArray(images)) {
        return images.map(normalizeImagePath).filter(Boolean);
    }
    if (typeof images === "string" && images.trim()) {
        return [normalizeImagePath(images)];
    }
    return [];
}

/** 安全解析字符串数组 JSON 字段 */
export function parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
    }
    return [];
}

/** 安全解析 affiliateLinks */
export function parseAffiliateLinks(value: unknown): Record<string, string> | null {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const result: Record<string, string> = {};
        for (const [key, val] of Object.entries(value)) {
            if (typeof val === "string" && val.trim()) {
                result[key] = val;
            }
        }
        return Object.keys(result).length > 0 ? result : null;
    }
    return null;
}

/** 验证图片 URL 格式 (支持 http/https 绝对地址或 / 开头的相对路径) */
export function validateImageUrl(url: string): string | null {
    if (!url || typeof url !== "string") return "Invalid image URL";
    if (url.length > MAX_IMAGE_URL_LENGTH) return `Image URL too long (max ${MAX_IMAGE_URL_LENGTH} chars)`;
    const isAbsolute = /^https?:\/\//.test(url);
    const isRelative = url.startsWith("/");
    if (!isAbsolute && !isRelative) return "Invalid image URL format (must be absolute URL or relative path starting with /)";
    if (isAbsolute) {
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) return "Invalid image URL scheme (must be http or https)";
        } catch {
            return "Invalid image URL format";
        }
    }
    return null; // null = valid
}
