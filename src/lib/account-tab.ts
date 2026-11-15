/** 账户弹层一级 tab 白名单（与主站 /?account=<tab> 约定对齐） */
export const ACCOUNT_TABS = ["profile", "diary", "vip", "mall"] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** 主站安全中心等 tab 在子站暂无独立面板，统一落到个人信息 */
const ACCOUNT_TAB_ALIASES: Record<string, AccountTab> = {
  security: "profile",
  devices: "profile",
  authorizations: "profile",
  bindings: "profile",
  history: "profile",
  deletion: "profile",
};

export function isAccountTab(value: string | null | undefined): value is AccountTab {
  return !!value && (ACCOUNT_TABS as readonly string[]).includes(value);
}

export function normalizeAccountTab(value: string | null | undefined): AccountTab {
  if (isAccountTab(value)) return value;
  if (value && ACCOUNT_TAB_ALIASES[value]) return ACCOUNT_TAB_ALIASES[value];
  return "profile";
}
