// 会员中心（AccountModal 系）共享样式：弹层壳、卡片、标题、说明文字统一收敛于此，
// 与全站弹层规范（GiftModal/SkinTypesModal：#F7F4EE 底、40px 圆角、暖调阴影）对齐

/** 弹层壳：背景/圆角/暖调阴影 */
export const ACCOUNT_SHELL =
  "bg-[#F7F4EE] rounded-t-[28px] sm:rounded-[2.5rem] shadow-[0_45px_80px_-16px_rgba(61,47,37,0.18)]";

/** 内容卡：纯白底 + 暖色轻阴影 + 细描边（替代旧 bg-white/70，拉开与弹层米底的层次差） */
export const ACCOUNT_CARD =
  "rounded-2xl border border-brand-charcoal/[0.08] bg-white shadow-[0_2px_12px_rgba(61,47,37,0.05)]";

/** 可点入口行（护肤档案/会员中心/安全中心）：卡片底 + hover 加深 + 焦点环 */
export const ACCOUNT_ENTRY_ROW =
  `${ACCOUNT_CARD} group w-full flex items-center justify-between px-4 py-3 text-[13px] tracking-[0.05em] ` +
  "text-brand-charcoal/60 hover:text-brand-charcoal hover:border-brand-charcoal/20 transition-colors cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal/30";

/** 区块标题：与全站 font-serif font-light 规范一致 */
export const ACCOUNT_SECTION_TITLE =
  "text-base md:text-lg font-serif font-light text-brand-charcoal tracking-[0.02em]";

/** 次要说明文字（会员号/用量/进度等） */
export const ACCOUNT_MUTED_TEXT = "text-[12px] font-light text-brand-charcoal/55 tracking-[0.05em]";

/** 头像暖调阴影（替代冷灰 shadow-md） */
export const ACCOUNT_AVATAR_SHADOW = "shadow-[0_6px_16px_rgba(61,47,37,0.15)]";
