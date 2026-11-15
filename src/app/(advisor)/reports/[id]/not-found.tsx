import Link from "next/link";

export default function ReportNotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-4">
            <div className="w-full max-w-md rounded-2xl border border-brand-charcoal/[0.08] bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-charcoal/[0.04] text-2xl">
                    🗂️
                </div>
                <h2 className="mt-4 text-lg font-medium text-brand-charcoal">报告不存在或无权查看</h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-charcoal/60">
                    该报告可能已删除、已归档，或不属于当前账号。
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-brand-charcoal px-5 text-[13px] text-white"
                    >
                        返回首页
                    </Link>
                    <Link
                        href="/questions?edit=true"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-brand-charcoal/20 px-5 text-[13px] text-brand-charcoal/70"
                    >
                        重新测肤
                    </Link>
                </div>
            </div>
        </div>
    );
}
