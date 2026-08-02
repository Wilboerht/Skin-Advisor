"use client";

import { useState, memo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Image from "next/image";
import {
    Edit,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    Star,
    Loader2,
    CheckSquare,
    Square,
    Filter,
    ChevronDown,
    ImageOff,
    Search,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProductFormModal } from "./ProductFormModal";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { SerializedProduct } from "@/types/product";

interface ProductsClientProps {
    initialProducts: SerializedProduct[];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ProductRow = memo(function ProductRow({
    product,
    isSelected,
    onSelect,
    onDelete,
    onEdit
}: {
    product: SerializedProduct;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (product: SerializedProduct) => void;
}) {
    return (
        <tr
            className={`hover:bg-white transition-colors ${isSelected ? 'bg-[#1A1A1A]/[0.02]' : ''}`}
        >
            <td className="px-2 py-4 w-10 align-middle">
                <div className="flex items-center justify-center">
                    <button
                        type="button"
                        onClick={() => onSelect(product.id)}
                        className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60"
                        aria-label={isSelected ? "取消选择" : "选择"}
                    >
                        {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#1A1A1A]" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-[#E9E9E7] bg-[#1A1A1A]/[0.02] mx-auto sm:mx-0">
                    {product.image && (product.image.startsWith("/") || product.image.startsWith("http")) ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            unoptimized={product.image.startsWith("/")}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.img-fallback');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div
                        className={`img-fallback h-full w-full bg-[#1A1A1A]/5 flex flex-col items-center justify-center text-[#1A1A1A]/30 ${product.image && (product.image.startsWith("/") || product.image.startsWith("http")) ? 'hidden' : 'flex'}`}
                        aria-label="无图片"
                    >
                        <ImageOff className="w-5 h-5" />
                        <span className="sr-only">无图片</span>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4 align-middle">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-sm font-medium text-[#1A1A1A]">{product.name}</div>
                    </div>
                    {product.featured && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" aria-label="精选置顶" />
                    )}
                </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <span className="inline-flex rounded-full bg-[#1A1A1A]/5 px-2.5 py-0.5 text-xs font-medium text-[#5E5E5E]">
                    {product.category}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-[#1A1A1A]/60 align-middle">
                {product.price}
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${product.active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-[#1A1A1A]/5 text-[#1A1A1A]/50'
                    }`}>
                    {product.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {product.active ? '上架' : '下架'}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium align-middle">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className="rounded p-2 text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-colors"
                        aria-label={`编辑 ${product.name}`}
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(product.id)}
                        className="rounded p-2 text-red-600 hover:bg-red-50 transition-colors"
                        aria-label={`删除 ${product.name}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const data = await res.json();
        return data.error || fallback;
    } catch {
        return fallback;
    }
}

export default function ProductsClient({ initialProducts }: ProductsClientProps) {
    const router = useRouter();
    const toast = useToast();
    const [products, setProducts] = useState(initialProducts);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchLoading, setBatchLoading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; batch: boolean }>({
        show: false,
        id: null,
        batch: false
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<SerializedProduct | null>(null);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Pagination
    const [pageSize, setPageSize] = useState<number>(10);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        setSelectedIds([]);
        setCurrentPage(1);
    }, [categoryFilter, statusFilter, pageSize, searchQuery]);

    // Sync products state when initialProducts prop changes (e.g., after router.refresh())
    useEffect(() => {
        setProducts(initialProducts);
        setIsRefreshing(false);
    }, [initialProducts]);

    // Get unique categories from current products state (not stale initialProducts prop)
    const categories = [...new Set(products.map(p => p.category))];

    // Filter products
    const filteredProducts = products.filter(p => {
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
        if (statusFilter === "active" && !p.active) return false;
        if (statusFilter === "inactive" && p.active) return false;
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Paginate
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredProducts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredProducts.map(p => p.id));
        }
    };

    const handleBatchAction = async (action: string) => {
        if (selectedIds.length === 0) {
            return;
        }

        setBatchLoading(action);
        try {
            const res = await fetch('/api/admin/products/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, action }),
            });

            if (res.ok) {
                setIsRefreshing(true);
                router.refresh();
                setSelectedIds([]);
            } else {
                const message = await parseErrorMessage(res, "批量操作失败");
                toast.error(message);
            }
        } catch (e) {
            toast.error("网络异常，请稍后重试");
        } finally {
            setBatchLoading(null);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirm.batch) {
            if (selectedIds.length === 0) return;
            try {
                const res = await fetch('/api/admin/products/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds, action: 'delete' }),
                });

                if (res.ok) {
                    setIsRefreshing(true);
                    router.refresh();
                    setSelectedIds([]);
                } else {
                    const message = await parseErrorMessage(res, "批量删除失败");
                    toast.error(message);
                }
            } catch (e) {
                toast.error("网络异常，请稍后重试");
            }
        } else if (deleteConfirm.id) {
            try {
                const res = await fetch(`/api/admin/products/${deleteConfirm.id}`, {
                    method: 'DELETE',
                });

                if (res.ok) {
                    setIsRefreshing(true);
                    router.refresh();
                } else {
                    const message = await parseErrorMessage(res, "删除失败");
                    toast.error(message);
                }
            } catch (e) {
                toast.error("网络异常，请稍后重试");
            }
        }
        setDeleteConfirm({ show: false, id: null, batch: false });
    };

    return (
        <div className="relative space-y-6 animate-in fade-in duration-500">
            {/* Loading Overlay */}
            {isRefreshing && (
                <div className="absolute inset-0 z-50 bg-[#FDFBF7]/60 flex items-center justify-center rounded-2xl">
                    <Loader2 className="w-8 h-8 animate-spin text-[#1A1A1A]/40" />
                </div>
            )}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">产品管理</h1>
                    <p className="text-[#1A1A1A]/50 text-sm mt-1">
                        共 {products.length} 个产品
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setEditingProduct(null);
                        setModalOpen(true);
                    }}
                    className="flex items-center rounded-lg bg-[#3D4430] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#3D4430]/90 transition-colors"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    添加产品
                </button>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-[#1A1A1A]/10 shadow-sm">
                <Filter className="w-4 h-4 text-[#1A1A1A]/40" />
                {/* Category Filter */}
                <div className="relative min-w-[140px]">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-sm border border-[#E9E9E7] rounded-lg bg-white hover:bg-[#1A1A1A]/[0.02] hover:border-[#E9E9E7] focus:outline-none focus:ring-1 focus:ring-[#3D4430]/20 transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">所有分类</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40 pointer-events-none" />
                </div>

                {/* Status Filter */}
                <div className="relative min-w-[120px]">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-sm border border-[#E9E9E7] rounded-lg bg-white hover:bg-[#1A1A1A]/[0.02] hover:border-[#E9E9E7] focus:outline-none focus:ring-1 focus:ring-[#3D4430]/20 transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">所有状态</option>
                        <option value="active">已上架</option>
                        <option value="inactive">已下架</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40 pointer-events-none" />
                </div>

                {/* Search Input */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40" />
                    <input
                        type="text"
                        placeholder="搜索产品名称..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-1.5 text-sm border border-[#E9E9E7] rounded-lg bg-white hover:border-[#E9E9E7] focus:outline-none focus:ring-1 focus:ring-[#3D4430]/20 transition-all"
                    />
                </div>

                {(categoryFilter !== "all" || statusFilter !== "all") && (
                    <button
                        type="button"
                        onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); }}
                        className="px-3 py-1.5 text-xs font-medium text-[#1A1A1A]/50 hover:text-[#5E5E5E]"
                    >
                        清除筛选
                    </button>
                )}
                <span className="ml-auto text-xs text-[#1A1A1A]/40">
                    显示 {filteredProducts.length} / {products.length}
                </span>
            </div>

            {/* Batch Actions Bar - Floating Liquid Glass */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 p-3 bg-white rounded-2xl border border-[#1A1A1A]/10 shadow-lg animate-in fade-in slide-in-from-bottom-10 duration-500 w-full max-w-3xl ring-1 ring-[#1A1A1A]/5">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10 opacity-70" />
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A]/5 rounded-full border border-[#1A1A1A]/10">
                        <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
                            已选择 {selectedIds.length} 个产品
                        </span>
                    </div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={() => handleBatchAction('activate')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量上架'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBatchAction('deactivate')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-[#1A1A1A]/5 text-[#5E5E5E] border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/10 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'deactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量下架'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBatchAction('feature')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'feature' ? <Loader2 className="w-4 h-4 animate-spin" /> : '设为精选置顶'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBatchAction('unfeature')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'unfeature' ? <Loader2 className="w-4 h-4 animate-spin" /> : '取消精选置顶'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeleteConfirm({ show: true, id: null, batch: true })}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        批量删除
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="px-4 py-2 text-xs font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
                    >
                        取消
                    </button>
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-[#1A1A1A]/10 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-[#E9E9E7]" aria-label="产品列表">
                    <thead className="bg-[#1A1A1A]/[0.02] border-b border-[#1A1A1A]/5">
                        <tr>
                            <th scope="col" className="px-2 py-4 w-10 align-middle">
                                <div className="flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60"
                                        aria-label={selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? "取消全选" : "全选"}
                                    >
                                        {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                                            <CheckSquare className="w-5 h-5 text-[#1A1A1A]" />
                                        ) : (
                                            <Square className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">图片</th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">名称</th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">分类</th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">价格</th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">状态</th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-medium text-[#1A1A1A]/50 uppercase tracking-wider align-middle">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#E9E9E7]">
                        {paginatedProducts.map((product) => (
                            <ProductRow
                                key={product.id}
                                product={product}
                                isSelected={selectedIds.includes(product.id)}
                                onSelect={handleToggleSelect}
                                onDelete={(id) => setDeleteConfirm({ show: true, id, batch: false })}
                                onEdit={(p) => {
                                    setEditingProduct(p);
                                    setModalOpen(true);
                                }}
                            />
                        ))}
                        {paginatedProducts.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-[#1A1A1A]/50">
                                    暂无产品，点击&quot;添加产品&quot;开始。
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationBar
                page={safePage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                total={filteredProducts.length}
                limit={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                disabled={isRefreshing}
            />

            {/* Delete Confirm Modal */}
            <ConfirmModal
                isOpen={deleteConfirm.show}
                onClose={() => setDeleteConfirm({ show: false, id: null, batch: false })}
                onConfirm={handleDelete}
                title="确认删除"
                message={
                    deleteConfirm.batch
                        ? `确定要删除选中的 ${selectedIds.length} 个产品吗？此操作无法撤销。`
                        : '确定要删除此产品吗？此操作无法撤销。'
                }
                confirmText="删除"
                variant="danger"
            />

            {/* Product Form Modal */}
            <ProductFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                product={editingProduct}
                onSuccess={() => {
                    setIsRefreshing(true);
                    router.refresh();
                    setSelectedIds([]);
                }}
            />
        </div>
    );
}
