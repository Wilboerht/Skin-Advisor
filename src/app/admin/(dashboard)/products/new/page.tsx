import { redirect } from "next/navigation";

// 新建产品统一在 /admin/products 通过模态框处理，此处保留路由重定向。
export default function NewProductPage() {
    redirect("/admin/products");
}
