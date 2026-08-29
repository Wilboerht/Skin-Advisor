import { redirect } from "next/navigation";

export default async function ResetPasswordPage(props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    // 透传现有 query 参数（如 token），避免忘记密码流程丢失凭证
    const params = await props.searchParams;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string") {
            query.set(key, value);
        } else if (Array.isArray(value)) {
            value.forEach((v) => query.append(key, v));
        }
    }
    const qs = query.toString();
    redirect(`/?auth=forgot_password${qs ? `&${qs}` : ""}`);
}
