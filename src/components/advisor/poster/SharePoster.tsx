"use client";

import { forwardRef, useState, useEffect } from "react";
import QRCode from "qrcode";

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
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
      QRCode.toDataURL('https://advisor.nihplod.cn', { width: 80, margin: 1 })
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
          <div className="text-center mb-4" style={{ transform: 'translateY(240px) translateX(-70px)' }}>
            <p className="text-lg font-medium text-[#2d2a26]">
              {nickname}
            </p>
          </div>

          {/* 核心数据 */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center pl-54">
              <div className="text-5xl font-bold text-[#E53935]" style={{ transform: 'translateY(-148px) rotate(5deg)' }}>{score}<span className="text-sm font-bold">分</span></div>
            </div>

            <div className="text-center" style={{ transform: 'translate(-70px, 128px)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-[#e6d0a8]/30 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#5c4937]"
                    style={{ width: `${Math.min((skinAge / 60) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[#5c4937]">{skinAge} 岁</span>
              </div>
            </div>

            <div className="text-center px-6">
              <p className="text-sm text-[#5c4937] leading-relaxed">
                <span className="font-bold text-4xl mx-1" style={{ transform: 'translate(-97px, -45px)', display: 'inline-block' }}>{percentile}%</span>
              </p>
            </div>
          </div>

          {/* 二维码 */}
          {qrDataUrl && (
            <div className="mt-auto flex justify-center pb-2" style={{ transform: 'translate(20px, -20px)' }}>
              <img src={qrDataUrl} alt="二维码" className="w-16 h-16 rounded-lg" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
