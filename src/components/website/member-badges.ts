// 四档会员徽章：中文名 + 配色（历史值 ADVANCED 按金卡兜底，与后端 normalizeMembershipLevel 一致）
// AccountModal 「我的」/「会员」两个 tab 共用
export const MEMBER_BADGES: Record<string, { label: string; className: string }> = {
  SILVER: { label: "银卡会员", className: "border-slate-400/70 text-slate-500" },
  GOLD: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355]" },
  DIAMOND: { label: "钻石会员", className: "border-sky-400/70 text-sky-600" },
  ADVANCED: { label: "金卡会员", className: "border-[#C9A86C]/70 text-[#8B7355]" },
};
export const REGULAR_BADGE = { label: "普通会员", className: "border-brand-charcoal/15 text-brand-charcoal/65" };

export function getMemberBadge(level?: string | null) {
  return (level && MEMBER_BADGES[level]) || REGULAR_BADGE;
}
