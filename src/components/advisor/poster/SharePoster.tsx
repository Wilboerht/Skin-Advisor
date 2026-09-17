"use client";

import { forwardRef, useState, useEffect } from "react";
import { Inria_Serif, Noto_Sans_SC } from "next/font/google";
import type { PosterTemplate } from "./poster-templates";

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
  /** 版式配置：画布尺寸、素材与各字段坐标（见 poster-templates.ts） */
  template: PosterTemplate;
  nickname: string;
  score?: number;
  percentile?: number;
  skinTypeName?: string;
  skinAge?: number;
  waterOil?: number;
  persona?: string;
  summary?: string;
  avatar?: string | null;
  qrDataUrl?: string | null;
  /** 测肤日期（ISO），显示为 YYYY.MM.DD */
  certDate?: string;
  /** 报告会话 ID，截取后 6 位作为证书编号 */
  certId?: string;
}

export const SharePoster = forwardRef<HTMLDivElement, SharePosterProps>(
  function SharePoster(
    { template, nickname, score, percentile, skinTypeName, skinAge, waterOil, persona, summary, avatar, qrDataUrl, certDate, certId },
    ref
  ) {
    const [templateFailed, setTemplateFailed] = useState(false);
    const [overlayFailed, setOverlayFailed] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    useEffect(() => { setTemplateFailed(false); }, [template.assets.template]);
    useEffect(() => { setOverlayFailed(false); }, [template.assets.overlay]);
    useEffect(() => { setAvatarFailed(false); }, [avatar]);

    const fields = template.fields;

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{
          width: template.canvas.width,
          height: template.canvas.height,
          fontFamily: posterFontFamily,
        }}
      >
        {/* 第一层：背景模板图（比例与画布一致，铺满无需 object-fit） */}
        {template.assets.template && !templateFailed ? (
          <img
            src={template.assets.template}
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
          <div className="absolute z-10" style={template.avatar.style}>
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
        {template.assets.overlay && !overlayFailed && (
          <img
            src={template.assets.overlay}
            alt=""
            loading="eager"
            className="absolute z-20 pointer-events-none"
            style={template.assets.overlayStyle}
            onError={() => setOverlayFailed(true)}
          />
        )}

        {/* 第四层：所有文字字段（坐标全部来自模板配置） */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          <p className={`absolute ${fields.nickname.className}`} style={fields.nickname.style}>
            {nickname}
          </p>

          {skinAge !== undefined && (
            <p className={`absolute ${fields.skinAge.className}`} style={fields.skinAge.style}>
              {Math.round(skinAge)}岁
            </p>
          )}

          {waterOil !== undefined && (
            <p className={`absolute ${fields.waterOil.className}`} style={fields.waterOil.style}>
              {Math.round(waterOil)}分
            </p>
          )}

          {skinTypeName && (
            <p className={`absolute ${fields.skinTypeName.className}`} style={fields.skinTypeName.style}>
              「{skinTypeName}」
            </p>
          )}

          {score !== undefined ? (
            <p className={`absolute ${fields.score.className}`} style={fields.score.style}>
              {Math.round(score)}<span className="text-sm font-bold">分</span>
            </p>
          ) : (
            <p className="absolute text-2xl font-bold text-[#00263E] whitespace-nowrap" style={fields.score.style}>
              问卷评估
            </p>
          )}

          {persona && (
            <p className={`absolute ${fields.persona.className}`} style={fields.persona.style}>
              {addCJKSpace(persona)}
            </p>
          )}

          {summary && (
            <p className={`absolute ${fields.summary.className}`} style={fields.summary.style}>
              {addCJKSpace(summary)}
            </p>
          )}

          {/* "超越全国 X%" 伪统计已下线：ResultClient 不再传入 percentile；保留条件渲染仅作兼容 */}
          {percentile !== undefined && (
            <div className="absolute top-[47%] left-[78%] -translate-x-1/2">
              <p className="text-2xl font-bold text-[#00263E] whitespace-nowrap">{percentile}%</p>
            </div>
          )}

          {/* 二维码：仅含二维码的模板（小红书版模板配置为 null，不渲染） */}
          {qrDataUrl && template.qr && (
            <div className="absolute z-30" style={template.qr.style}>
              <img
                src={qrDataUrl}
                alt="二维码"
                loading="eager"
                decoding="sync"
                className="rounded-lg"
                style={{ width: template.qr.size, height: template.qr.size }}
              />
            </div>
          )}

          {(certDate || certId) && (
            <p className={`absolute ${fields.cert.className}`} style={fields.cert.style}>
              {certDate ? formatCertDate(certDate) : ""}
              {certDate && certId ? " · " : ""}
              {certId ? `No.${formatCertId(certId)}` : ""}
            </p>
          )}
        </div>
      </div>
    );
  }
);
