import { redirect } from "next/navigation";

// 「护肤档案」已合并进「我的」账户弹层的「护肤档案」tab。
// 保留旧路由作为深链接入口：/?account=diary 会自动打开对应 tab。
export default function DiaryPage() {
  redirect("/?account=diary");
}
