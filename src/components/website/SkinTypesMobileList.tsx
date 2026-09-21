"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";
import { getFactionIcon } from "@/components/website/faction-icons";

interface SkinTypesMobileListProps {
  types: SkinTypeData[];
  /** 透传给详情弹窗：分析等待期复用时隐藏"开始测肤"CTA */
  hideTestCTA?: boolean;
}

/**
 * SkinTypesMobileList — 移动端派系图鉴网格（替代轮播/列表）
 * 窄屏下轮播侧卡露边过窄、信息密度低，列表则过于"阅读流"；
 * 改为 2 列图鉴网格：形象为主角，名字为辅，点击打开详情弹窗（简介在弹窗内完整呈现）。
 * 桌面端仍由 SkinTypesClient 轮播承载。
 */
export function SkinTypesMobileList({ types, hideTestCTA = false }: SkinTypesMobileListProps) {
  const [selected, setSelected] = useState<SkinTypeData | null>(null);

  // 视口放大到桌面端时自动关闭详情：本组件被 display:none 隐藏后，
  // 弹窗状态与滚动锁会残留（看不见弹窗但整页无法滚动），必须在此释放
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767.98px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!e.matches) setSelected(null);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const closeDetail = () => setSelected(null);

  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {types.map((type) => {
          const Icon = getFactionIcon(type.ipKey);
          return (
            <li key={type.route} className="min-w-0">
              <button
                type="button"
                onClick={() => setSelected(type)}
                aria-label={`${type.typeName}（查看详情）`}
                className="group w-full flex flex-col items-center rounded-2xl border border-brand-espresso/[0.12] bg-white px-3 pt-4 pb-3.5 text-center transition-colors duration-300 hover:border-brand-espresso/[0.22] active:bg-brand-charcoal/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30"
              >
                <Image
                  src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                  alt=""
                  width={180}
                  height={180}
                  sizes="110px"
                  className="w-full max-w-[110px] h-auto object-contain pointer-events-none"
                />
                <span className="mt-2.5 flex items-center gap-1.5 text-[15px] font-serif font-light tracking-[0.02em] text-brand-charcoal">
                  <Icon aria-hidden="true" className="w-4 h-4 text-brand-charcoal/60 shrink-0" strokeWidth={1.75} />
                  {type.typeName}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <SkinTypeModal data={selected} onClose={closeDetail} hideTestCTA={hideTestCTA} />
    </>
  );
}
