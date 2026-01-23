
"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DeleteProductButton({ id }: { id: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        setLoading(true);
        try {
            await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
            router.refresh();
        } catch (e) {
            alert("Failed to delete");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
    );
}
