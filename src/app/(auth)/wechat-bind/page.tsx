import { redirect } from "next/navigation";

export default async function WechatBindPage(props: {
    searchParams: Promise<{ wechat_exchange_token?: string; redirect?: string }>;
}) {
    const params = await props.searchParams;
    const token = params.wechat_exchange_token;
    const redirectParam = params.redirect;

    if (!token) {
        // 缺少 exchange token，直接回到首页登录
        redirect("/?auth=login");
    }

    const target = redirectParam
        ? `/?login=wechat_bind&wechat_exchange_token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectParam)}`
        : `/?login=wechat_bind&wechat_exchange_token=${encodeURIComponent(token)}`;

    redirect(target);
}
