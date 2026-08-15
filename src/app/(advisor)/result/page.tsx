import { Metadata } from "next";
import ResultClient from "./ResultClient";
import { getSessionUser } from "@/lib/sso-auth";
import { redirect } from "next/navigation";

export default async function ResultPage(props: {
    searchParams: Promise<{ id?: string; status?: string }>;
}) {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    const status = searchParams.status;
    const user = await getSessionUser();

    // /result 只表示「当前结果」。
    // 登录用户且 URL 带了已完成报告的 id 时，直接跳转到历史报告页 /reports/:id，
    // 避免客户端先渲染 /result 再跳转的闪烁。
    // 会话数据由 ResultClient 客户端恢复（localStorage / 分析流程），此处无需重复预加载。
    if (id && status !== 'analyzing' && user) {
        redirect(`/reports/${id}`);
    }

    return <ResultClient id={id} initialData={null} user={user} />;
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "我的专业护肤报告",
        description: "基于 AI 的深度肤质分析，精准检测肤质类型，为您定制专属护肤方案与产品推荐。",
        robots: { index: false, follow: false },
    };
}
