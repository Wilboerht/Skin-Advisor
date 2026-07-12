"use client";

import { forwardRef, useState, useEffect } from "react";
import { Inria_Serif, Noto_Sans_SC } from "next/font/google";

const inriaSerif = Inria_Serif({ weight: ["400", "700"], subsets: ["latin"] });
const notoSansSC = Noto_Sans_SC({ weight: ["300", "400", "700"] });

const posterFontFamily = `${inriaSerif.style.fontFamily}, ${notoSansSC.style.fontFamily}`;

function addCJKSpace(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf])([a-zA-Z0-9])/g, "$1 $2")
    .replace(/([a-zA-Z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, "$1 $2");
}

interface SharePosterProps {
  nickname: string;
  score?: number;
  percentile?: number;
  skinTypeName?: string;
  skinAge?: number;
  waterOil?: number;
  persona?: string;
  summary?: string;
  avatar?: string | null;
  posterTemplate?: string;
  posterOverlay?: string;
  qrDataUrl?: string | null;
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(
  function SharePoster(
    { nickname, score, percentile, skinTypeName, skinAge, waterOil, persona, summary, avatar, posterTemplate, posterOverlay, qrDataUrl },
    ref
  ) {
    const [templateFailed, setTemplateFailed] = useState(false);
    const [overlayFailed, setOverlayFailed] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    useEffect(() => { setTemplateFailed(false); }, [posterTemplate]);
    useEffect(() => { setOverlayFailed(false); }, [posterOverlay]);
    useEffect(() => { setAvatarFailed(false); }, [avatar]);

    return (
      <div
        ref={ref}
        className="relative w-[480px] h-[640px] overflow-hidden"
        style={{ fontFamily: posterFontFamily }}
      >
        {/* 第一层：背景模板图 */}
        {posterTemplate && !templateFailed ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${posterTemplate})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onError={() => setTemplateFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5] to-[#F0E6D8]" />
        )}

        {/* 第二层：IP 形象 */}
        {avatar && !avatarFailed && (
          <div
            className="absolute z-10"
            style={{
              top: "10%",
              left: "4%",
              width: "40%",
              height: "auto",
              aspectRatio: "1",
              backgroundImage: `url(${avatar})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onErrorCapture={() => setAvatarFailed(true)}
          />
        )}

        {/* 第三层：装饰叠加图 */}
        {posterOverlay && !overlayFailed && (
          <div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              marginLeft: "1%",
              marginTop: "1.5%",
              backgroundImage: `url(${posterOverlay})`,
              backgroundSize: "85.5% auto",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onError={() => setOverlayFailed(true)}
          />
        )}

        {/* 第四层：所有文字字段 */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {/* 昵称 */}
          <div className="absolute top-[43.2%] left-[40%] -translate-x-1/2">
            <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{nickname}</p>
          </div>

          {/* 肌肤年龄 */}
          {skinAge !== undefined && (
            <div className="absolute top-[49.5%] left-[40%] -translate-x-1/2">
              <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{skinAge}岁</p>
            </div>
          )}

          {/* 水油平衡 */}
          {waterOil !== undefined && (
            <div className="absolute top-[55.8%] left-[40%] -translate-x-1/2">
              <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{waterOil}分</p>
            </div>
          )}

          {/* IP 名称 */}
          {skinTypeName && (
            <div className="absolute top-[24.5%] right-[5%] text-right">
              <p className="text-[34px] text-[#00263E] whitespace-nowrap">「{skinTypeName}」</p>
            </div>
          )}

          {/* 综合评分 */}
          <div className="absolute top-[46%] left-[61%] -translate-x-1/2">
            {score !== undefined ? (
              <p className="text-[66px] font-bold text-[#00263E] whitespace-nowrap">{score}<span className="text-sm font-bold">分</span></p>
            ) : (
              <p className="text-2xl font-bold text-[#00263E] whitespace-nowrap">问卷评估</p>
            )}
          </div>

          {/* IP 专属标语 */}
          {persona && (
            <div className="absolute top-[34%] right-[10%] text-right max-w-[280px]">
              <p className="text-[10px] font-light text-[#00263E] whitespace-nowrap leading-relaxed">{addCJKSpace(persona)}</p>
            </div>
          )}

          {/* 概述 */}
          {summary && (
            <div className="absolute bottom-[25%] left-[13%] max-w-[160px]">
              <p className="text-[8px] font-light text-[#00263E] leading-relaxed">{addCJKSpace(summary)}</p>
            </div>
          )}

          {/* 全国超越百分比 */}
          {percentile !== undefined && (
            <div className="absolute top-[47%] left-[78%] -translate-x-1/2">
              <p className="text-2xl font-bold text-[#00263E] whitespace-nowrap">{percentile}%</p>
            </div>
          )}

          {/* 二维码 */}
          {qrDataUrl && (
            <div className="absolute top-[71.9%] left-[72.7%] -translate-x-1/2">
              <img src={qrDataUrl} alt="二维码" className="w-20 h-20 rounded-lg" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
