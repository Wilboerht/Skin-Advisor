import { redirect } from "next/navigation";

interface GuestReportPageProps {
    searchParams: Promise<{ id?: string }>;
}

export default async function GuestReportPage(props: GuestReportPageProps) {
    const searchParams = await props.searchParams;
    const { id } = searchParams;

    // 旧分享页已废弃，统一跳转到完整结果页
    if (id) {
        redirect(`/result?id=${id}`);
    }

    redirect("/result");
}
