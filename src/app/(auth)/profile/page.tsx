import { redirect } from "next/navigation";

// 「我的」已改为 Dock 内账户弹层（AccountModal），/profile 旧链接通过
// /?account=profile 深链接打开对应 tab。
export default function ProfilePage() {
  redirect("/?account=profile");
}
