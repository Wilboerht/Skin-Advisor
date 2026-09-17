import type { CSSProperties } from "react";

/**
 * 海报模板配置（多版本）
 *
 * 两套模板同画布比例、不同设计：所有版式数值集中在这里，SharePoster 只按配置渲染。
 * 新模板图到位后：补 assets 路径 → 按图微调 fields/qr 坐标 → 把 ready 置 true，
 * 保存弹层会自动多出一个版本选项。
 */

export type PosterTemplateId = "classic" | "xhs";

export interface PosterFieldStyle {
  /** 绝对定位（百分比，与画布同坐标系） */
  style: CSSProperties;
  /** 文本样式（字号/字色/截断/最大宽度/对齐） */
  className: string;
}

export interface PosterTemplate {
  id: PosterTemplateId;
  label: string;
  /** 选择弹层中的一句话说明 */
  description: string;
  /** 素材是否就绪：未就绪不进入选择弹层 */
  ready: boolean;
  /** 逻辑画布尺寸（导出尺寸 = canvas × pixelRatio） */
  canvas: { width: number; height: number };
  /** 导出倍率 */
  pixelRatio: number;
  assets: {
    template: string;
    overlay: string;
    /** 叠加层定位（同坐标系百分比） */
    overlayStyle: CSSProperties;
  };
  /** IP 形象定位（宽度用百分比） */
  avatar: { style: CSSProperties };
  fields: {
    nickname: PosterFieldStyle;
    skinAge: PosterFieldStyle;
    waterOil: PosterFieldStyle;
    skinTypeName: PosterFieldStyle;
    /** 综合评分（无评分时渲染"问卷评估"占位，共用此配置） */
    score: PosterFieldStyle;
    persona: PosterFieldStyle;
    summary: PosterFieldStyle;
    /** 落款：日期 · 编号 */
    cert: PosterFieldStyle;
  };
  /** 二维码：null = 不展示（小红书版不带二维码） */
  qr: { style: CSSProperties; size: number } | null;
  /** 导出文件名后缀（经典版为空串） */
  filenameSuffix: string;
}

const TEXT = "text-[#00263E]";

/** 经典版字段坐标（xhs 未定稿前先复用做起点，待新图微调） */
const CLASSIC_FIELDS: PosterTemplate["fields"] = {
  nickname: {
    style: { top: "43.2%", left: "40%", transform: "translateX(-50%)" },
    className: `text-xs font-light ${TEXT} max-w-[140px] truncate`,
  },
  skinAge: {
    style: { top: "49.5%", left: "40%", transform: "translateX(-50%)" },
    className: `text-xs font-light ${TEXT} whitespace-nowrap`,
  },
  waterOil: {
    style: { top: "55.8%", left: "40%", transform: "translateX(-50%)" },
    className: `text-xs font-light ${TEXT} whitespace-nowrap`,
  },
  skinTypeName: {
    style: { top: "24.5%", right: "5%" },
    className: `text-[34px] ${TEXT} max-w-[220px] truncate text-right`,
  },
  score: {
    style: { top: "46%", left: "61%", transform: "translateX(-50%)" },
    className: `text-[66px] font-bold ${TEXT} whitespace-nowrap`,
  },
  persona: {
    style: { top: "34%", right: "10%" },
    className: `text-[10px] font-light ${TEXT} leading-relaxed line-clamp-2 text-right max-w-[180px]`,
  },
  summary: {
    style: { bottom: "25%", left: "13%" },
    className: `text-[8px] font-light ${TEXT} leading-relaxed line-clamp-4 max-w-[160px]`,
  },
  cert: {
    style: { bottom: "4.5%", right: "5%" },
    className: "text-[9px] font-light text-[#00263E]/70 whitespace-nowrap tracking-wide text-right",
  },
};

export const POSTER_TEMPLATES: Record<PosterTemplateId, PosterTemplate> = {
  classic: {
    id: "classic",
    label: "经典版",
    description: "通用平台（微信 / 微博等），含二维码",
    ready: true,
    canvas: { width: 480, height: 640 },
    pixelRatio: 2,
    assets: {
      template: "/images/poster-template.webp?v=5",
      overlay: "/images/poster-overlay.webp",
      overlayStyle: {
        width: "85.5%",
        height: "auto",
        left: "50%",
        top: "50%",
        transform: "translate(-49%, -47.5%)",
      },
    },
    avatar: { style: { top: "10%", left: "4%", width: "40%" } },
    fields: CLASSIC_FIELDS,
    qr: {
      style: { top: "71.9%", left: "72.7%", transform: "translateX(-50%)" },
      size: 80,
    },
    filenameSuffix: "",
  },

  // 小红书版：素材待补（放入 public/images/ 后将 ready 置 true，并按新图微调坐标）
  xhs: {
    id: "xhs",
    label: "小红书版",
    description: "小红书专用版式，无二维码",
    ready: false,
    canvas: { width: 480, height: 640 },
    pixelRatio: 2,
    assets: {
      template: "/images/poster-template-xhs.webp",
      overlay: "/images/poster-overlay-xhs.webp",
      overlayStyle: {
        width: "85.5%",
        height: "auto",
        left: "50%",
        top: "50%",
        transform: "translate(-49%, -47.5%)",
      },
    },
    avatar: { style: { top: "10%", left: "4%", width: "40%" } },
    fields: CLASSIC_FIELDS,
    qr: null,
    filenameSuffix: "-小红书",
  },
};

/** 全部模板（含未就绪） */
export const POSTER_TEMPLATE_LIST = Object.values(POSTER_TEMPLATES);

/** 已就绪模板：只有它参与保存版本选择 */
export const READY_POSTER_TEMPLATES = POSTER_TEMPLATE_LIST.filter((t) => t.ready);

export const DEFAULT_POSTER_TEMPLATE_ID: PosterTemplateId = "classic";

export function isPosterTemplateId(value: string | null | undefined): value is PosterTemplateId {
  return value === "classic" || value === "xhs";
}
