"use client";

import { forwardRef, useState, useEffect } from "react";
import { toDataURL } from "qrcode";
import { Palette, Droplets } from "lucide-react";

interface SharePosterProps {
  nickname: string;
  score: number;
  skinTone: number;
  waterOil: number;
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
    { nickname, score, skinTone, waterOil, percentile, avatar, posterTemplate },
    ref
  ) {
    const templateUrl = posterTemplate ? getAbsoluteUrl(posterTemplate) : null;
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
      toDataURL(typeof window !== 'undefined' ? window.location.origin : 'https://advisor.nihplod.cn', { width: 80, margin: 1, color: { dark: '#3F2C76', light: '#0000' } })
        .then(url => setQrDataUrl(url))
        .catch(() => setQrDataUrl(null));
    }, []);

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
              top: 258,
              right: 280,
              width: 32,
              height: 32,
            }}
          >
            <img
              src={avatar}
              alt={nickname}
              className="w-full h-full object-cover object-center"
              crossOrigin="anonymous"
            />
          </div>
        )}

        {/* 内容层 */}
        <div className="relative z-10 flex flex-col h-full p-6">
          {/* 昵称 */}
          <div className="text-center mb-4" style={{ transform: 'translateY(238px) translateX(-70px)' }}>
            <p className="text-lg font-medium text-[#2d2a26]">
              {nickname}
            </p>
          </div>

          {/* 核心数据 */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center pl-54">
              <div className="text-5xl font-bold text-[#E53935]" style={{ transform: 'translateY(-88px) rotate(5deg)' }}>{score}<span className="text-sm font-bold">分</span></div>
            </div>

            <div className="text-center" style={{ transform: 'translate(-70px, 190px)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-sm bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Palette className="w-2.5 h-2.5 text-blue-500" />
                </div>
                <div className="w-16 h-1.5 rounded-full bg-blue-200/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(skinTone, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#5c4937]">{skinTone} 分</span>
              </div>
            </div>

            <div className="text-center" style={{ transform: 'translate(-70px, 190px)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-sm bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Droplets className="w-2.5 h-2.5 text-amber-500" />
                </div>
                <div className="w-16 h-1.5 rounded-full bg-amber-200/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${Math.min(waterOil, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#5c4937]">{waterOil} 分</span>
              </div>
            </div>

            <div className="text-center px-6">
              <p className="text-sm text-[#5c4937] leading-relaxed">
                <span className="font-bold text-4xl mx-1" style={{ transform: 'translate(-97px, -28px)', display: 'inline-block' }}>{percentile}%</span>
              </p>
            </div>
          </div>

          {/* 二维码 */}
          {qrDataUrl && (
            <div className="mt-auto flex justify-center pb-2" style={{ transform: 'translate(100px, -77.5px)' }}>
              <img src={qrDataUrl} alt="二维码" className="w-16 h-16 rounded-lg" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
