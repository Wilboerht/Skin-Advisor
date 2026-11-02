export const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://smart.nihplod.cn"
).replace(/\/+$/, "");
