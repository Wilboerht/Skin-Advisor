/**
 * 从派系骨架（m4 早晚节奏）+ 推荐产品，生成确定性的 AM/PM 行动表。
 * 不额外调用 AI，保证老报告也能复用；AI 的 routineNote 作为“本次个性化调整”叠加。
 */

import { getSkinTypeByIpKey } from "@/lib/result-content";

export interface RoutineProduct {
    id: string;
    name: string;
    category?: string | null;
    howToUse?: string | null;
}

export interface RoutineStep {
    text: string;
    productId?: string;
    productName?: string;
    category?: string;
    howToUse?: string;
}

export interface RoutinePlan {
    title: string;
    morning: RoutineStep[];
    night: RoutineStep[];
    note?: string;
    onlyOneSet?: string;
    formulaCore?: string;
}

interface BuildRoutineInput {
    persona?: string | null;
    products?: RoutineProduct[] | null;
}

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
    { keywords: ["卸妆", "洁面", "清洁"], category: "洁面" },
    { keywords: ["精华", "安瓶"], category: "精华露" },
    { keywords: ["面霜", "乳液", "封层", "保湿"], category: "面霜" },
    { keywords: ["防晒"], category: "防晒" },
    { keywords: ["面膜"], category: "面膜" },
    { keywords: ["美容油", "护理油", "油"], category: "护理油" },
];

function splitSteps(text?: string): string[] {
    if (!text) return [];
    return text
        .split(/[→>]/)
        .map((step) => step.replace(/^[\s·、，,]+|[\s。；;]+$/g, "").trim())
        .filter(Boolean)
        .slice(0, 6);
}

function findProduct(stepText: string, products: RoutineProduct[]): RoutineProduct | undefined {
    const matchedCategory = CATEGORY_KEYWORDS.find((item) =>
        item.keywords.some((keyword) => stepText.includes(keyword))
    )?.category;
    if (!matchedCategory) return undefined;

    return products.find((product) =>
        (product.category && product.category.includes(matchedCategory))
        || (matchedCategory === "精华露" && product.name.includes("精华"))
        || (matchedCategory === "面霜" && product.name.includes("面霜"))
        || (matchedCategory === "洁面" && (product.name.includes("洁面") || product.name.includes("清洁")))
        || (matchedCategory === "防晒" && product.name.includes("防晒"))
        || (matchedCategory === "面膜" && product.name.includes("面膜"))
        || (matchedCategory === "护理油" && product.name.includes("油"))
    );
}

function toSteps(text: string | undefined, products: RoutineProduct[]): RoutineStep[] {
    return splitSteps(text).map((stepText) => {
        const product = findProduct(stepText, products);
        return {
            text: stepText,
            productId: product?.id,
            productName: product?.name,
            category: product?.category ?? undefined,
            howToUse: product?.howToUse ?? undefined,
        };
    });
}

export function buildRoutinePlan({ persona, products }: BuildRoutineInput): RoutinePlan | null {
    if (!persona) return null;
    const data = getSkinTypeByIpKey(persona);
    if (!data) return null;

    const morningText = data.m4?.morning;
    const nightText = data.m4?.night;
    if (!morningText && !nightText) return null;

    const productList = (products ?? []).filter((product) => !!product?.name);
    const morning = toSteps(morningText, productList);
    const night = toSteps(nightText, productList);
    if (morning.length === 0 && night.length === 0) return null;

    return {
        title: data.m4?.title || "你的每日方案",
        morning,
        night,
        note: data.m4?.note,
        onlyOneSet: data.m7?.onlyOneSet,
        formulaCore: data.m7?.formulaCore,
    };
}
