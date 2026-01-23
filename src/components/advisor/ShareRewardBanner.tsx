"use client";

import { useRouter } from "next/navigation";
import { Gift, ArrowRight } from "lucide-react";

interface ShareRewardBannerProps {
    score: number;
    percentile: number;
}

export function ShareRewardBanner({ score, percentile }: ShareRewardBannerProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => {
                // 由于 share-reward 页面尚未实现完全，暂时不跳转或跳转到一个待开发页面
                // 或者我们可以简单弹个 Toast
                // 为了完整性，我们应该至少有一个路由处理，即使页面是简单的
                router.push(`/share-reward?score=${score}&percentile=${percentile}`);
            }}
            className="mb-8 cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100 p-4 shadow-sm hover:shadow-md transition-all relative group"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 group-hover:scale-110 transition-transform shadow-inner">
                    <Gift className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-medium text-rose-900 group-hover:text-rose-700 font-serif">
                        分享肌肤报告，赢取专属好礼
                    </h3>
                    <p className="text-sm text-rose-700/80 mt-1">
                        您的肌肤评分 <span className="font-bold">{score}</span> 分，超越了 {percentile}% 的用户！
                        <span className="inline-flex items-center ml-2 text-rose-600 font-medium group-hover:underline">
                            立即领取 <ArrowRight className="h-3 w-3 ml-1" />
                        </span>
                    </p>
                </div>
            </div>
            {/* 装饰圆圈 */}
            <div className="absolute -right-4 -bottom-8 h-24 w-24 rounded-full bg-rose-200/20 group-hover:bg-rose-200/30 transition-colors pointer-events-none" />
        </div>
    );
}
