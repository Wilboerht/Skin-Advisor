
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

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
        <div className="flex h-screen bg-gray-100 font-sans">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto p-8">
                <div className="mx-auto max-w-6xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
