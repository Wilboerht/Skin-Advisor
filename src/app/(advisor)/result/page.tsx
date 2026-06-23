import { Metadata } from "next";
import ResultClient from "./ResultClient";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ResultPage(props: {
    searchParams: Promise<{ id?: string; status?: string }>;
}) {
    const searchParams = await props.searchParams;
    const id = searchParams.id;
    const status = searchParams.status;
    const user = await getSession();

    // /result 只表示「当前结果」，不带 id。
    // 如果 URL 带了 id，按身份分流到正确的地方。
    if (id && status !== 'analyzing') {
        if (user) {
            // 登录用户的历史报告去 /reports/:id
            redirect(`/reports/${id}`);
        } else {
            // 游客只能从当前设备的 localStorage 看当前结果
            redirect('/result');
        }
    }

    // 当前结果由客户端从 localStorage 或分析流程恢复
    return <ResultClient id={undefined} initialData={null} />;
}

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "我的专业护肤报告 | MySkinToday Technology",
        description: "基于 AI 的深度肤质分析，为您定制专属护肤方案。",
    };
}
