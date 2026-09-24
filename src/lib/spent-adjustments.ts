/**
 * 消费补录业务常量与展示文案（客户端安全，无服务端依赖）
 *
 * 与官网 nihplod.cn 的 src/lib/spent-adjustment-meta.ts 保持同口径：
 * 渠道白名单、状态文案、上限与凭证图片取值规则。
 * 校验与提交由官网侧执行（子站 BFF 仅透传），此处常量用于表单控件/展示。
 */

// 业务常量（与官网一致）
export const MAX_PENDING_PER_USER = 2; // 同一用户同时最多待审申请数
export const MAX_IMAGES = 3; // 凭证截图上限
export const MAX_ORDER_NO_LENGTH = 64;
export const MAX_DEALER_NAME_LENGTH = 50; // 经销商名称长度上限

// 提交渠道白名单（用户表单，按官网业务顺序）
export const SPENT_CHANNELS = [
  "TMALL",
  "DOUYIN",
  "XIAOHONGSHU",
  "OFFLINE",
  "DEALER",
  "OTHER",
] as const;

export type SpentChannel = (typeof SPENT_CHANNELS)[number];

// 渠道展示文案（含历史渠道，存量数据可正常展示）
export const SPENT_CHANNEL_LABELS: Record<string, string> = {
  TMALL: "天猫国际",
  DOUYIN: "抖音商城",
  XIAOHONGSHU: "小红书",
  OFFLINE: "线下专柜",
  DEALER: "经销渠道",
  OTHER: "其它",
  // 历史渠道（仅存量数据展示）
  JD: "京东",
  MINIPROGRAM: "微信小程序",
};

export const SPENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

/**
 * 凭证图片取值规则（与官网一致）：
 * - 以 http(s):// 开头的值是可直接访问的绝对 URL；
 * - 以 / 开头的是官网本地存储模式返回的相对路径（如 /uploads/...），
 *   在子站必须补全为官网 origin，否则会错误地指向子站域名；
 * - 其余值视为官网私有 bucket 的 objectName，经子站 BFF 鉴权签名端点访问。
 */
export function isDirectImageUrl(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith("/");
}

/** 官网 origin（本地 http 开发兼容，未配置时等于线上主站） */
const OFFICIAL_ORIGIN = (process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn").replace(/\/+$/, "");

/** 凭证图片展示地址（私有 objectName 走子站 BFF 签名端点） */
export function receiptImageSrc(value: string): string {
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/")) return `${OFFICIAL_ORIGIN}${value}`;
  return `/api/account/spent-adjustments/image?key=${encodeURIComponent(value)}`;
}
