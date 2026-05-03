"use client";

import { forwardRef } from "react";

interface SharePosterProps {
  nickname: string;
  score: number;
  skinAge: number;
  percentile: number;
  avatar?: string | null;
  posterTemplate?: string;
}

/** 获取完整的图片 URL（用于 html2canvas） */
function getAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${window.location.origin}${path}`;
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(
  function SharePoster(
    { nickname, score, skinAge, percentile, avatar, posterTemplate },
    ref
  ) {
    const templateUrl = posterTemplate ? getAbsoluteUrl(posterTemplate) : null;

    return (
      <div
        ref={ref}
        className="relative w-[360px] h-[640px] overflow-hidden"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {/* 背景模板图片 */}
        {templateUrl ? (
          <img
            src={templateUrl}
            alt="海报模板"
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5] to-[#F0E6D8]">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "radial-gradient(#5c4937 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>
        )}

        {/* 头像 — 绝对定位到模板圆圈位置 */}
        {avatar && (
          <div
            className="absolute z-20 rounded-full overflow-hidden"
            style={{
              top: 252,
              right: 277,
              width: 36,
              height: 36,
              border: '3px solid rgba(255,255,255,0.9)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
          >
            <img
              src={avatar}
              alt={nickname}
              className="w-full h-full object-cover object-top"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* 内容层 */}
        <div className="relative z-10 flex flex-col h-full p-6">
          {/* 昵称 */}
          <div className="text-center mb-4" style={{ transform: 'translateY(240px)' }}>
            <p className="text-lg font-medium text-[#2d2a26]">
              亲爱的「{nickname}」
            </p>
          </div>

          {/* 核心数据 */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center pl-52">
              <div className="text-5xl font-bold text-[#E53935]" style={{ transform: 'translateY(-133px) rotate(5deg)' }}>{score}</div>
            </div>

            <div className="text-center">
              <div className="text-xs text-[#8c7a6b] mb-1">肌肤年龄</div>
              <div className="text-3xl font-medium text-[#5c4937]">
                {skinAge} <span className="text-base">岁</span>
              </div>
            </div>

            <div className="text-center px-6">
              <p className="text-sm text-[#5c4937] leading-relaxed">
                您的肌肤状态超越了全国
                <span className="font-bold mx-1">{percentile}%</span>
                的用户
              </p>
            </div>
          </div>

          {/* 底部 */}
          <div className="mt-auto pt-4 border-t border-[#5c4937]/10 text-center">
            <p className="text-[10px] text-[#a89582] tracking-wider">
              扫码体验 AI 肌肤分析
            </p>
          </div>
        </div>
      </div>
    );
  }
);
