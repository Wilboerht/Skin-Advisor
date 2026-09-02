import { redirect } from "next/navigation";

// 「护肤档案」已改为全局弹层（DiaryModal），独立路由保留作兼容：旧链接 301 回首页
export default function DiaryPage() {
  redirect("/");
}
