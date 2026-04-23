"use client";

/**
 * 产品卡片骨架屏
 */
export function ProductCardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
            {/* 图片区域 */}
            <div className="aspect-square bg-gray-100" />

            {/* 内容区域 */}
            <div className="p-4 space-y-3">
                {/* 分类标签 */}
                <div className="h-4 w-12 bg-gray-100 rounded" />

                {/* 产品名称 */}
                <div className="h-5 w-3/4 bg-gray-100 rounded" />

                {/* 推荐理由 */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-50 rounded" />
                    <div className="h-3 w-2/3 bg-gray-50 rounded" />
                </div>

                {/* 价格行 */}
                <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                    <div className="h-4 w-16 bg-gray-100 rounded" />
                    <div className="h-4 w-8 bg-gray-50 rounded" />
                </div>
            </div>
        </div>
    );
}

/**
 * 步骤分组骨架屏
 */
export function StepGroupSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            {/* 步骤标题 */}
            <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full bg-gray-100" />
                <div className="h-5 w-24 bg-gray-100 rounded" />
            </div>

            {/* 产品卡片网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <ProductCardSkeleton />
                <ProductCardSkeleton />
                <ProductCardSkeleton />
            </div>
        </div>
    );
}

/**
 * 完整推荐区域骨架屏
 */
export function ProductRecommendationSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
        </div>
    );
}

export default ProductCardSkeleton;
