"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useTransition } from "react";

/**
 * 带路由预取与即时反馈的页面跳转 hook。
 *
 * 解决移动端点击顶部栏按钮"没反应、要点好多下"的问题：
 * 裸用 router.push 属于冷导航 —— 点击后才去拉取目标页的 RSC payload 与 JS chunk，
 * 导航提交前 URL 不变、页面无任何 loading 反馈，用户会误以为没点上而反复点击，
 * 而重复点击又会取消上一次进行中的导航，进一步拖慢跳转。
 *
 * - mount 后预取 prefetchRoutes，让跳转近乎即时（dev 下还会触发目标路由提前编译）；
 * - push 包裹在 startTransition 中，导航提交前 isPending 保持 true，
 *   用于禁用按钮 / 显示加载态，给用户提供即时反馈。
 */
export function useNavPush(prefetchRoutes: string[] = []) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        for (const route of prefetchRoutes) {
            try {
                router.prefetch(route);
            } catch {
                // 预取失败不阻塞主流程，点击时仍会正常跳转
            }
        }
        // 仅在挂载时预取一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const push = useCallback(
        (href: string) => {
            startTransition(() => {
                router.push(href);
            });
        },
        [router]
    );

    return { push, isPending };
}
