import { redirect } from "next/navigation";

// 「我的」已改为 Dock 内账户弹层（AccountModal），旧 /profile 链接重定向到首页
export default function ProfilePage() {
    redirect("/");
}
