import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EmergencyLoginForm } from "./EmergencyLoginForm";

export const dynamic = "force-dynamic";

export default async function EmergencyLoginPage() {
  // 显式读取请求头，确保 env 开关在运行时判断，而不是构建期静态化
  await headers();

  if (process.env.ADMIN_BREAK_GLASS_ENABLED !== "true") {
    notFound();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#1A1A1A]/10 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold text-[#1A1A1A]">应急登录</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#1A1A1A]/50">
          仅用于主站管理员 SSO 不可用时的紧急维护。需要应急账号密码与
          Authenticator 动态验证码。
        </p>
        <EmergencyLoginForm />
      </div>
    </div>
  );
}
