"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    Copy,
    AlertTriangle,
    Filter
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Product {
    id: string;
    name: string;
    nameEn: string | null;
    category: string;
    price: string;
    image: string;
    active: boolean;
    featured: boolean;
    stock: number;
    sortOrder: number;
}

interface ProductsClientProps {
    initialProducts: Product[];
}

function SortableProductRow({
    product,
    isSelected,
    onSelect,
    onDelete
}: {
    product: Product;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: product.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-slate-50' : ''}`}
        >
            <td className="px-2 py-4 w-10">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1"
                >
                    <GripVertical className="w-4 h-4" />
                </button>
            </td>
            <td className="px-2 py-4 w-10">
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
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                    <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                    />
                </div>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-sm font-medium text-slate-900">{product.name}</div>
                        <div className="text-xs text-slate-500">{product.nameEn}</div>
                    </div>
                    {product.featured && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {product.category}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                {product.price}
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${product.active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                    }`}>
                    {product.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {product.active ? '上架' : '下架'}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1 text-sm font-medium ${product.stock <= 0
                    ? 'text-red-600'
                    : product.stock <= 10
                        ? 'text-amber-600'
                        : 'text-slate-600'
                    }`}>
                    {product.stock <= 10 && product.stock > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {product.stock <= 0 ? '已售罄' : product.stock}
                </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-1">
                    <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="编辑"
                    >
                        <Edit className="h-4 w-4" />
                    </Link>
                    <Link
                        href={`/admin/products/new?clone=${product.id}`}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="复制"
                    >
                        <Copy className="h-4 w-4" />
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
}

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
    const [stockFilter, setStockFilter] = useState<string>("all");

    // Get unique categories
    const categories = [...new Set(initialProducts.map(p => p.category))];

    // Filter products
    const filteredProducts = products.filter(p => {
        if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
        if (statusFilter === "active" && !p.active) return false;
        if (statusFilter === "inactive" && p.active) return false;
        if (stockFilter === "low" && p.stock > 10) return false;
        if (stockFilter === "out" && p.stock > 0) return false;
        return true;
    });

    // Count low stock items
    const lowStockCount = products.filter(p => p.stock <= 10 && p.stock > 0).length;
    const outOfStockCount = products.filter(p => p.stock <= 0).length;

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
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
                    feature: '设为推荐',
                    unfeature: '取消推荐',
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
                        {lowStockCount > 0 && (
                            <span className="ml-2 text-amber-600">
                                <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" />
                                {lowStockCount} 库存预警
                            </span>
                        )}
                        {outOfStockCount > 0 && (
                            <span className="ml-2 text-red-600">
                                {outOfStockCount} 已售罄
                            </span>
                        )}
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
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-slate-200">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                    <option value="all">所有分类</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                    <option value="all">所有状态</option>
                    <option value="active">已上架</option>
                    <option value="inactive">已下架</option>
                </select>
                <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                >
                    <option value="all">所有库存</option>
                    <option value="low">库存预警 (≤10)</option>
                    <option value="out">已售罄</option>
                </select>
                {(categoryFilter !== "all" || statusFilter !== "all" || stockFilter !== "all") && (
                    <button
                        onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setStockFilter("all"); }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                        清除筛选
                    </button>
                )}
                <span className="ml-auto text-xs text-slate-400">
                    显示 {filteredProducts.length} / {products.length}
                </span>
            </div>

            {/* Batch Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-slate-900 text-white rounded-lg animate-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-medium">
                        已选择 {selectedIds.length} 个产品
                    </span>
                    <div className="flex-1" />
                    <button
                        onClick={() => handleBatchAction('activate')}
                        disabled={batchLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                    >
                        {batchLoading === 'activate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量上架'}
                    </button>
                    <button
                        onClick={() => handleBatchAction('deactivate')}
                        disabled={batchLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-600 hover:bg-slate-700 rounded transition-colors"
                    >
                        {batchLoading === 'deactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : '批量下架'}
                    </button>
                    <button
                        onClick={() => handleBatchAction('feature')}
                        disabled={batchLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                    >
                        {batchLoading === 'feature' ? <Loader2 className="w-4 h-4 animate-spin" /> : '设为推荐'}
                    </button>
                    <button
                        onClick={() => setDeleteConfirm({ show: true, id: null, batch: true })}
                        disabled={batchLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                        批量删除
                    </button>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
                    >
                        取消
                    </button>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-2 py-3 w-10"></th>
                            <th className="px-2 py-3 w-10">
                                <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-600">
                                    {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                                        <CheckSquare className="w-5 h-5" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">图片</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">名称</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">分类</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">价格</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">库存</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
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
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                    暂无产品，点击"添加产品"开始。
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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
