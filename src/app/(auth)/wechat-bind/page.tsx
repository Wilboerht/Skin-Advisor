import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function WechatBindPage(props: {
    searchParams: Promise<{ redirect?: string }>;
}) {
    const params = await props.searchParams;
    const redirectParam = params.redirect;

    // exchange token 已通过 httpOnly Cookie 传递（__Host-wechat_bind_token），不再经过 URL
    const cookieStore = await cookies();
    const hasToken = !!cookieStore.get("__Host-wechat_bind_token")?.value;

    if (!hasToken) {
        // 缺少 exchange token，直接回到首页登录
        redirect("/?auth=login");
    }

    const target = redirectParam
        ? `/?login=wechat_bind&redirect=${encodeURIComponent(redirectParam)}`
        : `/?login=wechat_bind`;

    redirect(target);
}
