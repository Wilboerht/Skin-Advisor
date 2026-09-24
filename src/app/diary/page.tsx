import { redirect } from "next/navigation";

// 「护肤档案」已合并进「我的」账户弹层的「护肤档案」tab，独立路由保留作兼容：旧链接 307 回首页
export default function DiaryPage() {
  redirect("/");
}
