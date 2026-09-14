"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";
import { getFactionIcon } from "@/components/website/faction-icons";

interface SkinTypesMobileListProps {
  types: SkinTypeData[];
  /** ?type=<route> 深链接（服务端解析）的初始选中派系 */
  initialType?: SkinTypeData | null;
}

/**
 * SkinTypesMobileList — 移动端派系列表（替代轮播）
 * 窄屏下轮播侧卡露边过窄、信息密度低，改为纵向单列卡片：
 * 全宽阅读（简介可读）、点击打开详情弹窗；桌面端仍由 SkinTypesClient 轮播承载。
 */
export function SkinTypesMobileList({ types, initialType = null }: SkinTypesMobileListProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(null);
  const router = useRouter();

  // 深链接自动打开详情：仅移动端（桌面端由轮播组件负责，避免隐藏的一侧重复弹窗）
  useEffect(() => {
    if (!initialType) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767.98px)").matches) {
      setSelected(initialType);
    }
  }, [initialType]);

  // 关闭详情弹窗：深链接进入时清理 URL，避免刷新后又自动弹出
  const closeDetail = () => {
    setSelected(null);
    if (initialType) router.replace("/skin-types", { scroll: false });
  };

  return (
    <>
      <ul className="flex flex-col gap-3">
        {types.map((type) => {
          const Icon = getFactionIcon(type.ipKey);
          return (
            <li key={type.route}>
              <button
                type="button"
                onClick={() => setSelected(type)}
                aria-label={`${type.typeName}（查看详情）`}
                className="group w-full flex items-center gap-4 rounded-2xl border border-brand-espresso/[0.12] bg-white p-4 text-left transition-colors duration-300 hover:border-brand-espresso/[0.22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30"
              >
                <span className="shrink-0 w-[96px] h-[96px] flex items-center justify-center">
                  <Image
                    src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                    alt=""
                    width={180}
                    height={180}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-[16px] font-serif font-light tracking-[0.02em] text-brand-charcoal">
                    <Icon aria-hidden="true" className="w-4 h-4 text-brand-charcoal/60 shrink-0" strokeWidth={1.75} />
                    {type.typeName}
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-brand-charcoal/60 font-light line-clamp-2">
                    {type.m1.persona}
                  </span>
                  <span className="mt-2 inline-flex items-center text-[12px] font-light tracking-[0.08em] text-brand-charcoal/55">
                    查看完整解读
                    <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <SkinTypeModal data={selected} onClose={closeDetail} />
    </>
  );
}
