// 四档会员徽章：中文名 + 配色（历史值 ADVANCED 按金卡兜底，与后端 normalizeMembershipLevel 一致）
// AccountModal 「我的」/「会员」两个 tab 共用；底色为描边色的 8% 透明，避免纯描边在米底上发虚
export const MEMBER_BADGES: Record<string, { label: string; className: string }> = {
  SILVER: { label: "银卡会员", className: "border-slate-400/70 text-slate-500 bg-slate-400/[0.08]" },
  GOLD: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355] bg-[#C9A86C]/[0.08]" },
  DIAMOND: { label: "钻石会员", className: "border-sky-400/70 text-sky-600 bg-sky-400/[0.08]" },
  ADVANCED: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355] bg-[#C9A86C]/[0.08]" },
};
export const REGULAR_BADGE = { label: "普通会员", className: "border-brand-charcoal/25 text-brand-charcoal/65 bg-brand-charcoal/[0.04]" };

export function getMemberBadge(level?: string | null) {
  return (level && MEMBER_BADGES[level]) || REGULAR_BADGE;
}
