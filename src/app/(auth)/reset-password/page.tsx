import { redirect } from "next/navigation";

export default async function ResetPasswordPage() {
    // 密码重置已统一由主站 SSO 账号中心处理（主站仅支持手机号 + 短信验证码，
    // 不接受 URL token）。不在站内转发 token，避免凭证留在地址栏/历史记录中。
    redirect("/?auth=forgot_password");
}
