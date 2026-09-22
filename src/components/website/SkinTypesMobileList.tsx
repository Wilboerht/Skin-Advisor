"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { SkinTypeData } from "@/lib/result-content";
import { SkinTypeModal } from "@/components/website/SkinTypeModal";
import { getFactionIcon } from "@/components/website/faction-icons";

interface SkinTypesMobileListProps {
  types: SkinTypeData[];
  /** 透传给详情弹窗：分析等待期复用时隐藏"开始测肤"CTA */
  hideTestCTA?: boolean;
}

/**
 * SkinTypesMobileList — 移动端派系列表（单列横排卡）
 * 窄屏下轮播侧卡露边过窄、信息密度低；2 列图鉴网格滚动过长且只有名字。
 * 改为单列横排卡：左形象 56px + 右派系名与一句简介 + 右箭头，
 * 行高约 100px，8 个派系滚动距离明显缩短、扫读性更好。
 * 纵向节奏规范：行间隙 8、卡内「名称→简介」8、简介行高 1.6（与桌面轮播卡一致）。
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
      <ul className="flex flex-col gap-2">
        {types.map((type) => {
          const Icon = getFactionIcon(type.ipKey);
          return (
            <li key={type.route} className="min-w-0">
              <button
                type="button"
                onClick={() => setSelected(type)}
                aria-label={`${type.typeName}（查看详情）`}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-brand-espresso/[0.12] bg-white px-3.5 py-3 text-left transition-colors duration-300 hover:border-brand-espresso/[0.22] active:bg-brand-charcoal/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30"
              >
                <Image
                  src={`/images/character/${type.ipKey}/${type.ipKey}_female.webp`}
                  alt=""
                  width={180}
                  height={240}
                  sizes="56px"
                  className="w-14 shrink-0 h-auto object-contain pointer-events-none"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] font-serif font-light tracking-[0.02em] text-brand-charcoal">
                    <Icon aria-hidden="true" className="w-4 h-4 text-brand-charcoal/60 shrink-0" strokeWidth={1.75} />
                    {type.typeName}
                  </span>
                  <span className="mt-2 block text-[12px] text-brand-charcoal/60 font-light leading-[1.6] line-clamp-2">
                    {type.m1.persona}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="w-4 h-4 shrink-0 text-brand-charcoal/30 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </button>
            </li>
          );
        })}
      </ul>

      <SkinTypeModal data={selected} onClose={closeDetail} hideTestCTA={hideTestCTA} />
    </>
  );
}
