/**
 * 活跃产品列表短缓存（60s）。
 *
 * 产品库变化频率低，但推荐评分需要完整 Product 行；缓存可避免每次测肤都全表加载。
 * 管理端增删改、批量操作和主站同步完成后必须调用 invalidateActiveProductsCache()，
 * 保证运营修改立即生效，而不是最多等 60 秒。
 */
import prisma from "@/lib/prisma";

export type ActiveProductRow = Awaited<ReturnType<typeof prisma.product.findMany>>[number];

const TTL_MS = 60_000;

let cache: { rows: ActiveProductRow[]; expiresAt: number } | null = null;
let inflight: Promise<ActiveProductRow[]> | null = null;
let generation = 0;

export async function getActiveProductsCached(): Promise<ActiveProductRow[]> {
    if (cache && cache.expiresAt > Date.now()) return cache.rows;

    if (inflight) return inflight;

    const currentGeneration = generation;
    const task = prisma.product
        .findMany({ where: { active: true } })
        .then((rows) => {
            // 失效发生在查询期间时不写回旧结果
            if (currentGeneration === generation) {
                cache = { rows, expiresAt: Date.now() + TTL_MS };
            }
            return rows;
        })
        .finally(() => {
            // 避免旧请求清掉新请求的 inflight
            if (inflight === task) inflight = null;
        });

    inflight = task;
    return task;
}

/** 产品被管理端/同步任务修改后调用；下一次请求会重新查询。 */
export function invalidateActiveProductsCache(): void {
    generation += 1;
    cache = null;
    inflight = null;
}
