import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理员登录",
  description: "NIHPLOD 管理后台登录。",
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
