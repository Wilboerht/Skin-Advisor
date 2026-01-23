
import ProductForm from "@/components/admin/ProductForm";

export default function NewProductPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
            <ProductForm />
        </div>
    );
}
