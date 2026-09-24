/**
 * 官网资源图片地址归一化（积分商城礼品/商品图等）。
 *
 * 官网（主站）把商品图片存为站内相对路径（如 /uploads/products/xxx.webp），
 * 主站页面同源渲染正常；子站（advisor 域）拿到后直接渲染会把请求打到子站
 * 自身域名 → 404。这里统一补全为官网 origin；已是绝对 URL 的原样返回。
 * 裸文件名（历史手工录入数据）按官网商品上传目录 products 补全。
 */
const OFFICIAL_ORIGIN = (
  process.env.NEXT_PUBLIC_SSO_BASE_URL || "https://nihplod.cn"
).replace(/\/+$/, "");

export function officialImageSrc(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/")) return `${OFFICIAL_ORIGIN}${value}`;
  if (value.includes("/")) return `${OFFICIAL_ORIGIN}/${value}`;
  return `${OFFICIAL_ORIGIN}/uploads/products/${value}`;
}
