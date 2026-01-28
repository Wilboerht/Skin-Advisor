/**
 * 护肤流程产品管理模块
 * 支持将推荐产品加入当日护肤流程
 */

const ROUTINE_PRODUCTS_KEY = 'myskin_routine_products';

export interface RoutineProduct {
    productId: string;
    productName: string;
    productCategory: string;
    productImage: string;
    step: string; // 护肤步骤
    addedAt: string;
    slot: 'morning' | 'evening' | 'both';
}

export interface DailyRoutineProducts {
    date: string; // YYYY-MM-DD
    morning: RoutineProduct[];
    evening: RoutineProduct[];
}

// ===== 日期格式化 =====

function formatDateKey(date: Date = new Date()): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ===== 本地存储操作 =====

function getRoutineProducts(): Record<string, DailyRoutineProducts> {
    if (typeof window === 'undefined') return {};

    try {
        const stored = localStorage.getItem(ROUTINE_PRODUCTS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse routine products:', e);
    }

    return {};
}

function saveRoutineProducts(data: Record<string, DailyRoutineProducts>): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(ROUTINE_PRODUCTS_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save routine products:', e);
    }
}

// ===== 公共 API =====

/**
 * 获取某天的护肤产品列表
 */
export function getDailyProducts(date?: Date): DailyRoutineProducts {
    const dateKey = formatDateKey(date);
    const allData = getRoutineProducts();

    return allData[dateKey] || {
        date: dateKey,
        morning: [],
        evening: []
    };
}

/**
 * 添加产品到护肤流程
 */
export function addProductToRoutine(
    product: {
        id: string;
        name: string;
        category: string;
        image: string;
        step?: string;
    },
    slot: 'morning' | 'evening' | 'both' = 'both',
    date?: Date
): void {
    const dateKey = formatDateKey(date);
    const allData = getRoutineProducts();

    const dailyData = allData[dateKey] || {
        date: dateKey,
        morning: [],
        evening: []
    };

    const routineProduct: RoutineProduct = {
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        productImage: product.image,
        step: product.step || inferStepFromCategory(product.category),
        addedAt: new Date().toISOString(),
        slot
    };

    // 避免重复添加
    const isInMorning = dailyData.morning.some(p => p.productId === product.id);
    const isInEvening = dailyData.evening.some(p => p.productId === product.id);

    if ((slot === 'morning' || slot === 'both') && !isInMorning) {
        dailyData.morning.push({ ...routineProduct, slot: 'morning' });
        // 按步骤顺序排序
        dailyData.morning.sort((a, b) => getStepOrder(a.step) - getStepOrder(b.step));
    }

    if ((slot === 'evening' || slot === 'both') && !isInEvening) {
        dailyData.evening.push({ ...routineProduct, slot: 'evening' });
        dailyData.evening.sort((a, b) => getStepOrder(a.step) - getStepOrder(b.step));
    }

    allData[dateKey] = dailyData;
    saveRoutineProducts(allData);

    // 触发事件
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('routine-products-updated', {
            detail: { action: 'add', productId: product.id, date: dateKey }
        }));
    }
}

/**
 * 从护肤流程移除产品
 */
export function removeProductFromRoutine(
    productId: string,
    slot: 'morning' | 'evening' | 'both' = 'both',
    date?: Date
): void {
    const dateKey = formatDateKey(date);
    const allData = getRoutineProducts();
    const dailyData = allData[dateKey];

    if (!dailyData) return;

    if (slot === 'morning' || slot === 'both') {
        dailyData.morning = dailyData.morning.filter(p => p.productId !== productId);
    }

    if (slot === 'evening' || slot === 'both') {
        dailyData.evening = dailyData.evening.filter(p => p.productId !== productId);
    }

    allData[dateKey] = dailyData;
    saveRoutineProducts(allData);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('routine-products-updated', {
            detail: { action: 'remove', productId, date: dateKey }
        }));
    }
}

/**
 * 检查产品是否在今日流程中
 */
export function isProductInTodayRoutine(productId: string): {
    inMorning: boolean;
    inEvening: boolean;
} {
    const today = getDailyProducts();
    return {
        inMorning: today.morning.some(p => p.productId === productId),
        inEvening: today.evening.some(p => p.productId === productId)
    };
}

/**
 * 清空某天的护肤流程产品
 */
export function clearDailyProducts(slot: 'morning' | 'evening' | 'both' = 'both', date?: Date): void {
    const dateKey = formatDateKey(date);
    const allData = getRoutineProducts();
    const dailyData = allData[dateKey];

    if (!dailyData) return;

    if (slot === 'morning' || slot === 'both') {
        dailyData.morning = [];
    }
    if (slot === 'evening' || slot === 'both') {
        dailyData.evening = [];
    }

    allData[dateKey] = dailyData;
    saveRoutineProducts(allData);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('routine-products-updated', {
            detail: { action: 'clear', date: dateKey }
        }));
    }
}

// ===== 辅助函数 =====

const STEP_ORDER_MAP: Record<string, number> = {
    cleanser: 1,
    toner: 2,
    essence: 3,
    serum: 4,
    eye_cream: 5,
    cream: 6,
    sunscreen: 7,
    mask: 8,
    oil: 9,
    other: 99
};

function getStepOrder(step: string): number {
    return STEP_ORDER_MAP[step] || 99;
}

function inferStepFromCategory(category: string): string {
    const categoryMap: Record<string, string> = {
        '洁面': 'cleanser',
        '洁面乳': 'cleanser',
        '洗面奶': 'cleanser',
        '化妆水': 'toner',
        '爽肤水': 'toner',
        '精华液': 'essence',
        '精华': 'serum',
        '眼霜': 'eye_cream',
        '面霜': 'cream',
        '乳液': 'cream',
        '防晒': 'sunscreen',
        '防晒霜': 'sunscreen',
        '面膜': 'mask',
        '护肤油': 'oil'
    };
    return categoryMap[category] || 'other';
}

/**
 * 合并用户添加的产品到基础护肤流程
 */
export function mergeUserProductsWithRoutine(
    baseSteps: Array<{ order: number; name: string; category: string;[key: string]: any }>,
    userProducts: RoutineProduct[]
): typeof baseSteps {
    if (!userProducts || userProducts.length === 0) return baseSteps;

    // 创建一个用户产品的 Map (按 step 分组)
    const userProductsByStep = new Map<string, RoutineProduct>();
    userProducts.forEach(p => {
        userProductsByStep.set(p.step, p);
    });

    // 遍历基础步骤，查看是否有用户自定义的产品
    return baseSteps.map(step => {
        const stepKey = inferStepFromCategory(step.category);
        const userProduct = userProductsByStep.get(stepKey);

        if (userProduct) {
            return {
                ...step,
                name: userProduct.productName + ' ⭐',
                isUserAdded: true,
                userProductId: userProduct.productId
            };
        }

        return step;
    });
}
