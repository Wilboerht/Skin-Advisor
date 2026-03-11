import { redirect } from "next/navigation";

export default async function AdminDashboard() {
    redirect("/admin/products");
}
