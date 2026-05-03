"use client";

import { useState, memo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    GripVertical,
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
    ChevronDown
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Product {
    id: string;
    name: string;
    category: string;
    price: string;
    image: string;
    active: boolean;
    featured: boolean;
    sortOrder: number;
}

interface ProductsClientProps {
    initialProducts: Product[];
}

const SortableProductRow = memo(function SortableProductRow({
    product,
    isSelected,
    onSelect,
    onDelete,
    sortingDisabled
}: {
    product: Product;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    sortingDisabled?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: product.id, disabled: sortingDisabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-white/20 transition-colors ${isSelected ? 'bg-white/30' : ''}`}
        >
            <td className="px-2 py-4 w-10 align-middle">
                <div className="flex items-center justify-center">
                    {sortingDisabled ? (
                        <span className="text-slate-200 p-1 cursor-not-allowed" title="筛选状态下不可排序">
                            <GripVertical className="w-4 h-4" />
                        </span>
                    ) : (
                        <button
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                        >
                            <GripVertical className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </td>
            <td className="px-2 py-4 w-10 align-middle">
                <div className="flex items-center justify-center">
                    <button
                        onClick={() => onSelect(product.id)}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-slate-900" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 mx-auto sm:mx-0">
                    {product.image && /^https?:\/\//.test(product.image) ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-300 text-xs">无图</div>
                    )}
                </div>
            </td>
            <td className="px-4 py-4 align-middle">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-sm font-medium text-slate-900">{product.name}</div>
                    </div>
                    {product.featured && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {product.category}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 align-middle">
                {product.price}
            </td>
            <td className="px-4 py-4 whitespace-nowrap align-middle">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${product.active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                    }`}>
                    {product.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {product.active ? '上架' : '下架'}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium align-middle">
                <div className="flex items-center gap-1">
                    <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="编辑"
                    >
                        <Edit className="h-4 w-4" />
                    </Link>
                    <button
                        onClick={() => onDelete(product.id)}
                        className="rounded p-2 text-red-600 hover:bg-red-50 transition-colors"
                        title="删除"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
});

export default function ProductsClient({ initialProducts }: ProductsClientProps) {
    const router = useRouter();
    const toast = useToast();
    const [products, setProducts] = useState(initialProducts);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [batchLoading, setBatchLoading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null; batch: boolean }>({
        show: false,
        id: null,
        batch: false
    });

    // P7.10 Filters
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    useEffect(() => {
        setSelectedIds([]);
    }, [categoryFilter, statusFilter]);

    // Get unique categories
    const categories = [...new Set(initialProducts.map(p => p.category))];

    // Filter products
    const filteredProducts = products.filter(p => {
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
        if (statusFilter === "active" && !p.active) return false;
        if (statusFilter === "inactive" && p.active) return false;
            return true;
    });



    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const hasActiveFilters = categoryFilter !== "all" || statusFilter !== "all";

    const handleDragEnd = async (event: DragEndEvent) => {
        if (hasActiveFilters) {
            toast.info('请清除筛选条件后再进行排序');
            return;
        }

        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = products.findIndex((p) => p.id === active.id);
            const newIndex = products.findIndex((p) => p.id === over.id);
            const newProducts = arrayMove(products, oldIndex, newIndex);
            setProducts(newProducts);

            // Save new order
            setSaving(true);
            try {
                const res = await fetch('/api/admin/products/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderedIds: newProducts.map(p => p.id) }),
                });

                if (res.ok) {
                    toast.success('排序已保存');
                } else {
                    toast.error('保存失败');
                    setProducts(initialProducts);
                }
            } catch (e) {
                toast.error('网络错误');
                setProducts(initialProducts);
            } finally {
                setSaving(false);
            }
        }
    };

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
            toast.info('请先选择产品');
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
                const actionNames: Record<string, string> = {
                    activate: '上架',
                    deactivate: '下架',
                    feature: '设为精选置顶',
                    unfeature: '取消精选置顶',
                    delete: '删除'
                };
                toast.success(`${actionNames[action]}成功`);
                router.refresh();
                setSelectedIds([]);
            } else {
                toast.error('操作失败');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setBatchLoading(null);
        }
    };

    const handleDelete = async () => {
        const idsToDelete = deleteConfirm.batch ? selectedIds : (deleteConfirm.id ? [deleteConfirm.id] : []);

        if (idsToDelete.length === 0) return;

        try {
            const res = await fetch('/api/admin/products/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToDelete, action: 'delete' }),
            });

            if (res.ok) {
                toast.success('删除成功');
                router.refresh();
                setSelectedIds([]);
            } else {
                toast.error('删除失败');
            }
        } catch (e) {
            toast.error('网络错误');
        } finally {
            setDeleteConfirm({ show: false, id: null, batch: false });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">产品管理</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        共 {products.length} 个产品
                        {saving && <span className="ml-2 text-amber-600">保存中...</span>}
                    </p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    添加产品
                </Link>
            </div>

            {/* P7.10 Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/40 backdrop-blur-3xl rounded-2xl border-[1.5px] border-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.03),inset_0_1px_5px_rgba(255,255,255,0.4)] transition-all">
                <Filter className="w-4 h-4 text-slate-400" />
                {/* Category Filter */}
                <div className="relative min-w-[140px]">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">所有分类</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Status Filter */}
                <div className="relative min-w-[120px]">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all cursor-pointer appearance-none"
                    >
                        <option value="all">所有状态</option>
                        <option value="active">已上架</option>
                        <option value="inactive">已下架</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {(categoryFilter !== "all" || statusFilter !== "all") && (
                    <button
                        onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                        清除筛选
                    </button>
                )}
                <span className="ml-auto text-xs text-slate-400">
                    显示 {filteredProducts.length} / {products.length}
                </span>
            </div>

            {/* Batch Actions Bar - Floating Liquid Glass */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 p-3 bg-white/40 backdrop-blur-3xl rounded-[32px] border-[1.5px] border-white/60 shadow-[0_40px_100px_rgba(0,0,0,0.1),inset_0_2px_10px_rgba(255,255,255,0.4)] animate-in fade-in slide-in-from-bottom-10 duration-500 w-full max-w-2xl ring-1 ring-white/20">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10 opacity-70" />
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/5 rounded-full border border-slate-900/10">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            已选择 {selectedIds.length} 个产品
                        </span>
                    </div>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBatchAction('activate')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量上架'}
                    </button>
                    <button
                        onClick={() => handleBatchAction('deactivate')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-slate-900/5 text-slate-700 border border-slate-900/10 hover:bg-slate-900/10 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'deactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量下架'}
                    </button>
                    <button
                        onClick={() => handleBatchAction('feature')}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        {batchLoading === 'feature' ? <Loader2 className="w-4 h-4 animate-spin" /> : '设为精选置顶'}
                    </button>
                    <button
                        onClick={() => setDeleteConfirm({ show: true, id: null, batch: true })}
                        disabled={batchLoading !== null}
                        className="px-4 py-2 text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20 hover:bg-rose-500/20 rounded-2xl transition-all shadow-sm active:scale-95"
                    >
                        批量删除
                    </button>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
                    >
                        取消
                    </button>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="overflow-hidden rounded-[32px] border-[1.5px] border-white/60 bg-white/40 backdrop-blur-3xl shadow-[0_32px_100px_rgba(0,0,0,0.05),inset_0_2px_10px_rgba(255,255,255,0.4)]">
                    <table className="min-w-full divide-y divide-white/20">
                        <thead className="bg-white/30 border-b border-white/20">
                            <tr>
                                <th className="px-2 py-4 w-10 align-middle"></th>
                                <th className="px-2 py-4 w-10 align-middle">
                                    <div className="flex items-center justify-center">
                                        <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                                            {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                                                <CheckSquare className="w-5 h-5 text-slate-900" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">图片</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">名称</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">分类</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">价格</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">状态</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider align-middle">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            <SortableContext
                                items={filteredProducts.map(p => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {filteredProducts.map((product) => (
                                    <SortableProductRow
                                        key={product.id}
                                        product={product}
                                        isSelected={selectedIds.includes(product.id)}
                                        onSelect={handleToggleSelect}
                                        onDelete={(id) => setDeleteConfirm({ show: true, id, batch: false })}
                                        sortingDisabled={categoryFilter !== "all" || statusFilter !== "all"}
                                    />
                                ))}
                            </SortableContext>
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        暂无产品，点击"添加产品"开始。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </DndContext>

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
        </div>
    );
}
