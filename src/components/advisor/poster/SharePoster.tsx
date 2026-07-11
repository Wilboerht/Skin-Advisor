"use client";

import { forwardRef, useState } from "react";

interface SharePosterProps {
  nickname: string;
  score?: number;
  percentile?: number;
  skinTypeName?: string;
  skinAge?: number;
  waterOil?: number;
  persona?: string;
  avatar?: string | null;
  posterTemplate?: string;
  posterOverlay?: string;
  qrDataUrl?: string | null;
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(
  function SharePoster(
    { nickname, score, percentile, skinTypeName, skinAge, waterOil, persona, avatar, posterTemplate, posterOverlay, qrDataUrl },
    ref
  ) {
    const [templateFailed, setTemplateFailed] = useState(false);
    const [overlayFailed, setOverlayFailed] = useState(false);

    return (
      <div
        ref={ref}
        className="relative w-[480px] h-[640px] overflow-hidden"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {/* 第一层：背景模板图 */}
        {posterTemplate && !templateFailed ? (
          <img
            src={posterTemplate}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setTemplateFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5] to-[#F0E6D8]" />
        )}

        {/* 第二层：IP 形象 */}
        {avatar && (
          <div
            className="absolute z-10"
            style={{
              top: "10%",
              left: 0,
            }}
          >
            <img
              src={avatar}
              alt=""
              className="w-[40%] h-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* 第三层：装饰叠加图 */}
        {posterOverlay && !overlayFailed && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center translate-x-[1%] translate-y-[1.5%]">
            <img
              src={posterOverlay}
              alt=""
              className="w-[85.5%] h-auto object-contain"
              onError={() => setOverlayFailed(true)}
            />
          </div>
        )}

        {/* 第四层：所有文字字段 */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {/* 昵称 */}
          <div className="absolute top-[37%] left-[40%] -translate-x-1/2">
            <p className="text-sm font-light text-[#00263E] whitespace-nowrap">{nickname}</p>
          </div>

          {/* IP 名称 */}
          {skinTypeName && (
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2">
              <p className="text-xs tracking-widest text-[#8c7a6b] whitespace-nowrap">「{skinTypeName}」</p>
            </div>
          )}

          {/* 肌肤年龄 */}
          {skinAge !== undefined && (
            <div className="absolute top-[42%] left-[40%] -translate-x-1/2">
              <p className="text-sm font-light text-[#00263E] whitespace-nowrap">{skinAge}岁</p>
            </div>
          )}

          {/* 综合评分 */}
          <div className="absolute top-[56%] left-1/2 -translate-x-1/2">
            {score !== undefined ? (
               <p className="text-5xl font-bold text-[#00263e] whitespace-nowrap">{score}<span className="text-sm font-bold">分</span></p>
            ) : (
              <p className="text-2xl font-bold text-[#00263e] whitespace-nowrap">问卷评估</p>
            )}
          </div>

          {/* IP 专属标语 */}
          {persona && (
            <div className="absolute top-[64%] left-1/2 -translate-x-1/2 max-w-[420px]">
              <p className="text-sm text-[#5c4937] italic leading-relaxed text-center">{persona}</p>
            </div>
          )}

          {/* 全国超越百分比 */}
          {percentile !== undefined && (
            <div className="absolute top-[73%] left-1/2 -translate-x-1/2">
              <p className="text-4xl font-bold text-[#00263e] whitespace-nowrap">{percentile}%</p>
            </div>
          )}

          {/* 水油平衡 */}
          {waterOil !== undefined && (
            <div className="absolute top-[47%] left-[40%] -translate-x-1/2">
              <p className="text-sm font-light text-[#00263E] whitespace-nowrap">{waterOil}分</p>
            </div>
          )}

          {/* 二维码 */}
          {qrDataUrl && (
            <div className="absolute top-[84%] left-1/2 -translate-x-1/2">
              <img src={qrDataUrl} alt="二维码" className="w-16 h-16 rounded-lg" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
