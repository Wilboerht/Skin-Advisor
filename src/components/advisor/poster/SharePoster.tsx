"use client";

import { forwardRef, useState, useEffect } from "react";
import { Inria_Serif, Noto_Sans_SC } from "next/font/google";

const inriaSerif = Inria_Serif({ weight: ["400", "700"], subsets: ["latin"] });
const notoSansSC = Noto_Sans_SC({ weight: ["300", "400", "700"], preload: false });

const posterFontFamily = `${inriaSerif.style.fontFamily}, ${notoSansSC.style.fontFamily}`;

function addCJKSpace(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf])([a-zA-Z0-9])/g, "$1 $2")
    .replace(/([a-zA-Z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, "$1 $2");
}

function formatCertDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function formatCertId(sessionId?: string): string | null {
  if (!sessionId) return null;
  const last6 = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
  return last6.length >= 4 ? last6.toUpperCase() : null;
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
  /** 测肤日期（ISO），显示为 YYYY.MM.DD */
  certDate?: string;
  /** 报告会话 ID，截取后 6 位作为证书编号 */
  certId?: string;
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(
  function SharePoster(
    { nickname, score, percentile, skinTypeName, skinAge, waterOil, persona, summary, avatar, posterTemplate, posterOverlay, qrDataUrl, certDate, certId },
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
        {/* 第一层：背景模板图 （1440x1922≈3:4，与 480x640 同比例，无需 object-fit） */}
        {posterTemplate && !templateFailed ? (
          <img
            src={posterTemplate}
            alt=""
            loading="eager"
            className="absolute inset-0 w-full h-full"
            onError={() => setTemplateFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF8F5] to-[#F0E6D8]" />
        )}

        {/* 第二层：IP 形象 */}
        {avatar && !avatarFailed && (
          <div className="absolute z-10 w-[40%]" style={{ top: "10%", left: "4%" }}>
            <img
              src={avatar}
              alt=""
              loading="eager"
              className="w-full h-auto"
              onError={() => setAvatarFailed(true)}
            />
          </div>
        )}

        {/* 第三层：装饰叠加图 */}
        {posterOverlay && !overlayFailed && (
          <img
            src={posterOverlay}
            alt=""
            loading="eager"
            className="absolute z-20 pointer-events-none"
            style={{
              width: "85.5%",
              height: "auto",
              left: "50%",
              top: "50%",
              transform: "translate(-49%, -47.5%)",
            }}
            onError={() => setOverlayFailed(true)}
          />
        )}

        {/* 第四层：所有文字字段 */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          <div className="absolute top-[43.2%] left-[40%] -translate-x-1/2">
            <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{nickname}</p>
          </div>

          {skinAge !== undefined && (
            <div className="absolute top-[49.5%] left-[40%] -translate-x-1/2">
              <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{Math.round(skinAge)}岁</p>
            </div>
          )}

          {waterOil !== undefined && (
            <div className="absolute top-[55.8%] left-[40%] -translate-x-1/2">
              <p className="text-xs font-light text-[#00263E] whitespace-nowrap">{Math.round(waterOil)}分</p>
            </div>
          )}

          {skinTypeName && (
            <div className="absolute top-[24.5%] right-[5%] text-right">
              <p className="text-[34px] text-[#00263E] whitespace-nowrap">「{skinTypeName}」</p>
            </div>
          )}

          <div className="absolute top-[46%] left-[61%] -translate-x-1/2">
            {score !== undefined ? (
              <p className="text-[66px] font-bold text-[#00263E] whitespace-nowrap">{Math.round(score)}<span className="text-sm font-bold">分</span></p>
            ) : (
              <p className="text-2xl font-bold text-[#00263E] whitespace-nowrap">问卷评估</p>
            )}
          </div>

          {persona && (
            <div className="absolute top-[34%] right-[10%] text-right max-w-[280px]">
              <p className="text-[10px] font-light text-[#00263E] whitespace-nowrap leading-relaxed">{addCJKSpace(persona)}</p>
            </div>
          )}

          {summary && (
            <div className="absolute bottom-[25%] left-[13%] max-w-[160px]">
              <p className="text-[8px] font-light text-[#00263E] leading-relaxed line-clamp-4">{addCJKSpace(summary)}</p>
            </div>
          )}

          {/* "超越全国 X%" 伪统计已下线：ResultClient 不再传入 percentile；保留条件渲染仅作兼容，
              percentile 为 undefined 时不渲染该元素 */}
          {percentile !== undefined && (
            <div className="absolute top-[47%] left-[78%] -translate-x-1/2">
              <p className="text-2xl font-bold text-[#00263E] whitespace-nowrap">{percentile}%</p>
            </div>
          )}

          {qrDataUrl && (
            <div className="absolute top-[71.9%] left-[72.7%] -translate-x-1/2">
              <img src={qrDataUrl} alt="二维码" loading="eager" decoding="sync" className="w-20 h-20 rounded-lg" />
            </div>
          )}

          {(certDate || certId) && (
            <div className="absolute bottom-[4.5%] right-[5%] text-right">
              <p className="text-[9px] font-light text-[#00263E]/70 whitespace-nowrap tracking-wide">
                {certDate ? formatCertDate(certDate) : ""}
                {certDate && certId ? " · " : ""}
                {certId ? `No.${formatCertId(certId)}` : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
);
