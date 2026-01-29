
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { StockAlertBanner } from "@/components/admin/StockAlertBanner";

export default async function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const session = cookieStore.get("admin_session");

    if (!session) {
        redirect("/admin/login");
    }

    return (
        <ToastProvider>
            <div className="flex h-screen bg-[#FDFBF7] text-[#1A1A1A] font-sans">
                <AdminSidebar />
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="mx-auto max-w-6xl">
                        <StockAlertBanner />
                        {children}
                    </div>
                </main>
            </div>
        </ToastProvider>
    );
}
