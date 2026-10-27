"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Edit, ImageOff, Search, Star, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { isSuperAdmin } from "@/lib/permissions";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
    DataTable,
    IconButton,
    PageHeader,
    PanelCard,
    type Column,
} from "@/components/admin";
import { Tooltip } from "@/components/ui/Tooltip";

interface Product {
    id: string;
    name: string;
    category: string;
    price: string;
    image: string | null;
    active: boolean;
    featured: boolean;
    createdAt: string;
    sourceProductId?: string | null;
    sourceSyncedAt?: string | null;
    sourceMissingAt?: string | null;
    suitableSkinTypes?: unknown;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const STATUS_OPTIONS = [
    { value: "all", label: "全部状态" },
    { value: "active", label: "已上架" },
    { value: "inactive", label: "已下架" },
];

const SORT_OPTIONS = [
    { value: "createdAt", label: "按创建时间" },
    { value: "name", label: "按名称" },
];

export default function ProductsClient({ role }: { role: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const toast = useToast();
    const canDelete = isSuperAdmin(role);

    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const pageSize = Number(searchParams.get("pageSize") || 10) || 10;
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "createdAt";
    const order = searchParams.get("order") || "desc";

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [searchInput, setSearchInput] = useState(search);
    const [prevSearch, setPrevSearch] = useState(search);
    if (prevSearch !== search) {
        setPrevSearch(search);
        setSearchInput(search);
    }
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const updateParams = useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());
            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === "" || value === "all")
                    params.delete(key);
                else params.set(key, value);
            });
            if (!("page" in updates)) params.delete("page");
            router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
        },
        [pathname, router, searchParams],
    );

    const fetchProducts = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
                search,
                status,
            });
            if (category) params.set("category", category);
            if (sort) params.set("sort", sort);
            if (order) params.set("order", order);
            const res = await adminFetch(`/api/admin/products?${params}`, {
                signal: controller.signal,
            });
            if (!res.ok) throw new Error("加载产品列表失败");
            const data = await res.json();
            setProducts(data.products || []);
            setCategories(data.categories || []);
            setPagination(data.pagination);
            setSelectedIds([]);
            setLoadError("");
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") return;
            setLoadError(
                error instanceof Error ? error.message : "加载产品列表失败",
            );
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setLoading(false);
        }
    }, [page, pageSize, search, category, status, sort, order]);

    useEffect(() => {
        fetchProducts();
        return () => abortRef.current?.abort();
    }, [fetchProducts]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== search)
                updateParams({ search: searchInput || null });
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput, search, updateParams]);

    useEffect(() => {
        if (
            pagination &&
            pagination.totalPages > 0 &&
            page > pagination.totalPages
        ) {
            updateParams({ page: String(pagination.totalPages) });
        }
    }, [page, pagination, updateParams]);

    const runBatchAction = async (action: string, successMessage: string) => {
        if (selectedIds.length === 0) return;
        if (action === "delete") {
            const protectedProducts = products.filter(
                (product) =>
                    selectedIds.includes(product.id) &&
                    product.sourceProductId &&
                    !product.sourceMissingAt
            );
            if (protectedProducts.length > 0) {
                toast.error("已同步产品请在主站删除或下架");
                return;
            }
        }
        setActionLoading(action);
        try {
            const res = await adminFetch("/api/admin/products/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedIds, action }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || "操作失败");
            }
            toast.success(successMessage);
            await fetchProducts();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "操作失败");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.sourceProductId && !deleteTarget.sourceMissingAt) {
            toast.error("该产品由主站同步，请在主站删除或下架");
            return;
        }
        setActionLoading("delete");
        try {
            const res = await adminFetch(
                `/api/admin/products/${deleteTarget.id}`,
                {
                    method: "DELETE",
                },
            );
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error?.message || payload?.error || "删除失败");
            }
            toast.success("产品已删除");
            setDeleteTarget(null);
            await fetchProducts();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除失败");
        } finally {
            setActionLoading(null);
        }
    };

    const allSelected =
        products.length > 0 && selectedIds.length === products.length;
    const someSelected = selectedIds.length > 0 && !allSelected;

    const columns: Column<Product>[] = [
        {
            key: "select",
            title: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() =>
                        setSelectedIds(
                            allSelected
                                ? []
                                : products.map((product) => product.id),
                        )
                    }
                    aria-label="全选本页产品"
                    className="h-4 w-4 rounded border-brand-charcoal/20 text-brand-primary focus:ring-brand-primary"
                />
            ),
            width: "48px",
            align: "center",
            render: (_, product) => (
                <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() =>
                        setSelectedIds((current) =>
                            current.includes(product.id)
                                ? current.filter((id) => id !== product.id)
                                : [...current, product.id],
                        )
                    }
                    aria-label={`选择 ${product.name}`}
                    className="h-4 w-4 rounded border-brand-charcoal/20 text-brand-primary focus:ring-brand-primary"
                />
            ),
        },
        {
            key: "image",
            title: "图片",
            width: "80px",
            align: "center",
            render: (_, product) => (
                <div className="mx-auto h-12 w-12 overflow-hidden rounded-lg bg-brand-charcoal/[0.04]">
                    {product.image ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            unoptimized={product.image.startsWith("/")}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-brand-charcoal/55">
                            <ImageOff className="h-5 w-5" />
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: "name",
            title: "产品名称",
            width: "260px",
            render: (_, product) => (
                <div className="flex min-w-0 items-center gap-1.5">
                    <Link
                        href={`/admin/products/${product.id}/edit?returnTo=${encodeURIComponent(
                            `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`,
                        )}`}
                        className="min-w-0 truncate font-medium text-brand-charcoal transition-colors hover:text-brand-primary"
                        title={product.name}
                    >
                        {product.name}
                    </Link>
                    {product.sourceProductId ? (
                        product.sourceMissingAt ? (
                            <Badge variant="danger" size="sm">
                                主站已删除
                            </Badge>
                        ) : Array.isArray(product.suitableSkinTypes) &&
                          product.suitableSkinTypes.length === 0 ? (
                            <Badge variant="warning" size="sm">
                                待配置
                            </Badge>
                        ) : (
                            <Badge variant="secondary" size="sm">
                                主站同步
                            </Badge>
                        )
                    ) : null}
                    {product.featured && (
                        <Star
                            className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                            aria-label="精选置顶"
                        />
                    )}
                </div>
            ),
        },
        {
            key: "category",
            title: "分类",
            width: "130px",
            render: (_, product) => (
                <Badge variant="secondary">{product.category}</Badge>
            ),
        },
        {
            key: "price",
            title: "价格",
            width: "100px",
            render: (_, product) => (
                <span className="text-sm tabular-nums text-brand-charcoal/70">
                    {product.price}
                </span>
            ),
        },
        {
            key: "active",
            title: "状态",
            width: "90px",
            render: (_, product) => (
                <Badge variant={product.active ? "success" : "secondary"}>
                    {product.active ? "已上架" : "已下架"}
                </Badge>
            ),
        },
        {
            key: "createdAt",
            title: "创建时间",
            width: "120px",
            render: (_, product) => (
                <span className="whitespace-nowrap text-sm text-brand-charcoal/65">
                    {new Date(product.createdAt).toLocaleDateString("zh-CN")}
                </span>
            ),
        },
        {
            key: "actions",
            title: "操作",
            width: "104px",
            align: "right",
            render: (_, product) => (
                <div className="flex items-center justify-end gap-0.5">
                    <Tooltip content="编辑" side="top">
                        <IconButton
                            label={`编辑 ${product.name}`}
                            href={`/admin/products/${product.id}/edit?returnTo=${encodeURIComponent(
                                `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`,
                            )}`}
                        >
                            <Edit className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                    {canDelete &&
                        (!product.sourceProductId || product.sourceMissingAt) && (
                            <Tooltip content="删除" side="top">
                                <IconButton
                                    label={`删除 ${product.name}`}
                                    variant="danger"
                                    onClick={() => setDeleteTarget(product)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </IconButton>
                            </Tooltip>
                        )}
                </div>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="产品管理"
                description={`管理推荐产品与上架状态${pagination ? ` · 共 ${pagination.total} 个产品` : ""} · 产品基础信息由主站同步；新增/基础信息修改请前往主站`}
            />

            <PanelCard>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <form
                        className="relative min-w-[200px] flex-1"
                        onSubmit={(event) => {
                            event.preventDefault();
                            updateParams({ search: searchInput || null });
                        }}
                    >
                        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-charcoal/65" />
                        <Input
                            aria-label="搜索产品名称"
                            placeholder="搜索产品名称"
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                            className="pl-10"
                        />
                    </form>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Select
                            aria-label="按分类筛选"
                            options={[
                                { value: "", label: "全部分类" },
                                ...categories.map((item) => ({
                                    value: item,
                                    label: item,
                                })),
                            ]}
                            value={category}
                            onChange={(event) =>
                                updateParams({
                                    category: event.target.value || null,
                                })
                            }
                        />
                        <Select
                            aria-label="按状态筛选"
                            options={STATUS_OPTIONS}
                            value={status}
                            onChange={(event) =>
                                updateParams({ status: event.target.value })
                            }
                        />
                        <Select
                            aria-label="排序字段"
                            options={SORT_OPTIONS}
                            value={sort}
                            onChange={(event) =>
                                updateParams({ sort: event.target.value })
                            }
                        />
                        <Select
                            aria-label="排序方向"
                            options={[
                                { value: "desc", label: "降序" },
                                { value: "asc", label: "升序" },
                            ]}
                            value={order}
                            onChange={(event) =>
                                updateParams({ order: event.target.value })
                            }
                        />
                    </div>
                </div>
            </PanelCard>

            {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-primary/15 bg-brand-primary/[0.03] px-4 py-3">
                    <span className="mr-1 text-sm font-medium text-brand-charcoal">
                        已选 {selectedIds.length} 项
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            runBatchAction("activate", "产品已批量上架")
                        }
                        loading={actionLoading === "activate"}
                    >
                        批量上架
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            runBatchAction("deactivate", "产品已批量下架")
                        }
                        loading={actionLoading === "deactivate"}
                    >
                        批量下架
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            runBatchAction("feature", "产品已设为精选")
                        }
                        loading={actionLoading === "feature"}
                    >
                        设为精选
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            runBatchAction("unfeature", "产品已取消精选")
                        }
                        loading={actionLoading === "unfeature"}
                    >
                        取消精选
                    </Button>
                    {canDelete && (
                        <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setBatchDeleteOpen(true)}
                            disabled={!!actionLoading}
                        >
                            批量删除
                        </Button>
                    )}
                    <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="ml-auto text-sm text-brand-charcoal/65 hover:text-brand-charcoal"
                    >
                        取消选择
                    </button>
                </div>
            )}

            {loadError ? (
                <PanelCard>
                    <Empty
                        title="加载产品失败"
                        description={loadError}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchProducts}
                            >
                                重试
                            </Button>
                        }
                    />
                </PanelCard>
            ) : (
                <>
                    <DataTable
                        columns={columns}
                        tableLayout="fixed"
                        minWidth="1080px"
                        data={products}
                        loading={loading}
                        rowKey="id"
                        emptyText={
                            search ? `没有匹配「${search}」的产品` : "暂无产品"
                        }
                        mobileCard={(product) => (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-charcoal/[0.04]">
                                        {product.image ? (
                                            <Image
                                                src={product.image}
                                                alt={product.name}
                                                width={48}
                                                height={48}
                                                className="h-full w-full object-cover"
                                                unoptimized={product.image.startsWith(
                                                    "/",
                                                )}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-brand-charcoal/55">
                                                <ImageOff className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-brand-charcoal">
                                            {product.name}
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Badge variant="secondary">
                                                {product.category}
                                            </Badge>
                                            <Badge
                                                variant={
                                                    product.active
                                                        ? "success"
                                                        : "secondary"
                                                }
                                            >
                                                {product.active
                                                    ? "已上架"
                                                    : "已下架"}
                                            </Badge>
                                            {product.featured && (
                                                <Badge variant="warning">
                                                    精选
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-brand-charcoal/10 pt-2">
                                    <span className="text-sm tabular-nums text-brand-charcoal/70">
                                        {product.price}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <IconButton
                                            label={`编辑 ${product.name}`}
                                            href={`/admin/products/${product.id}/edit?returnTo=${encodeURIComponent(
                                                `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`,
                                            )}`}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </IconButton>
                                        {canDelete &&
                                            (!product.sourceProductId ||
                                                product.sourceMissingAt) && (
                                                <IconButton
                                                    label={`删除 ${product.name}`}
                                                    variant="danger"
                                                    onClick={() =>
                                                        setDeleteTarget(product)
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </IconButton>
                                            )}
                                    </div>
                                </div>
                            </div>
                        )}
                    />

                    {pagination && pagination.totalPages > 1 && (
                        <Pagination
                            page={pagination.page}
                            pageSize={pagination.limit ?? pageSize}
                            total={pagination.total}
                            onChange={(nextPage) =>
                                updateParams({ page: String(nextPage) })
                            }
                            onPageSizeChange={(size) =>
                                updateParams({
                                    pageSize: String(size),
                                    page: "1",
                                })
                            }
                        />
                    )}
                </>
            )}

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="删除产品"
                message={`确定要删除「${deleteTarget?.name ?? ""}」吗？此操作不可恢复。`}
                confirmText="确认删除"
                variant="danger"
                loading={actionLoading === "delete"}
            />

            <ConfirmModal
                isOpen={batchDeleteOpen}
                onClose={() => setBatchDeleteOpen(false)}
                onConfirm={async () => {
                    await runBatchAction("delete", "选中产品已删除");
                    setBatchDeleteOpen(false);
                }}
                title="批量删除产品"
                message={`确定要删除选中的 ${selectedIds.length} 个产品吗？此操作不可恢复。`}
                confirmText="确认删除"
                variant="danger"
                loading={actionLoading === "delete"}
            />
        </div>
    );
}
