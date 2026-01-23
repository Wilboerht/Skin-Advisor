
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteProductButton from "./DeleteProductButton";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                <Link
                    href="/admin/products/new"
                    className="flex items-center rounded-md bg-brand-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                            <tr key={product.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="relative h-12 w-12 overflow-hidden rounded-md border border-gray-200">
                                        {/* Use img for simplicity or Next Image if domain allowlisted. 
                         The existing code uses unsplash images. */}
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                    <div className="text-sm text-gray-500">{product.nameEn}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800">
                                        {product.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.price}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/products/${product.id}/edit`}
                                            className="rounded p-2 text-blue-600 hover:bg-blue-50"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                        <DeleteProductButton id={product.id} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No products found. Add one or run setup.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
