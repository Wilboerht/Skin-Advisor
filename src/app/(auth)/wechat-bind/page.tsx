import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { WECHAT_BIND_COOKIE_NAME } from "@/lib/wechat-constants";

export default async function WechatBindPage(props: {
    searchParams: Promise<{ redirect?: string }>;
}) {
    const params = await props.searchParams;
    const redirectParam = params.redirect;

    // exchange token 已通过 httpOnly Cookie 传递（WECHAT_BIND_COOKIE_NAME），不再经过 URL
    const cookieStore = await cookies();
    const hasToken = !!cookieStore.get(WECHAT_BIND_COOKIE_NAME)?.value;

    if (!hasToken) {
        // 缺少 exchange token，直接回到首页登录
        redirect("/?auth=login");
    }

    const target = redirectParam
        ? `/?login=wechat_bind&redirect=${encodeURIComponent(redirectParam)}`
        : `/?login=wechat_bind`;

    redirect(target);
}
