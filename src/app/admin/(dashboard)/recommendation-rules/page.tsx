"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { cn } from "@/lib/utils";
import { isSuperAdmin } from "@/lib/permissions";
import { needsRecommendationConfig } from "@/lib/product-readiness";
import { SKIN_TYPE_OPTIONS } from "@/types/product";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { AdminModal } from "@/components/ui/AdminModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
    DataTable,
    FormActions,
    IconButton,
    PageHeader,
    type Column,
} from "@/components/admin";

interface Product {
    id: string;
    name: string;
    category: string;
    active: boolean;
    keyIngredients?: unknown;
    benefits?: unknown;
    suitableSkinTypes?: unknown;
    recommendReasons?: unknown;
    sourceProductId?: string | null;
    sourceMissingAt?: string | null;
}

interface RecommendationRule {
    id: string;
    name: string;
    priority: number;
    conditions: Record<string, unknown>;
    message: string | null;
    active: boolean;
    productIds: string[];
    createdAt: string;
}

const CONCERNS = [
    "acne",
    "wrinkles",
    "spots",
    "sensitivity",
    "roughness",
    "dullness",
    "dark_circles",
    "dryness",
    "oil_control",
    "anti_aging",
    "waterOil",
    "hydration",
    "pores",
    "redness",
    "firmness",
];

const CONCERN_LABELS: Record<string, string> = {
    acne: "痘痘/粉刺",
    wrinkles: "细纹/皱纹",
    oil_control: "控油",
    pores: "毛孔",
    spots: "色斑",
    dullness: "暗沉",
    sensitivity: "敏感",
    redness: "泛红",
    firmness: "紧致",
    hydration: "补水",
    roughness: "粗糙",
    dark_circles: "黑眼圈",
    dryness: "干燥",
    anti_aging: "抗老",
    waterOil: "水油平衡",
};

function concernLabel(value: string) {
    return CONCERN_LABELS[value] ?? value;
}

const PERSONAS = [
    { value: "sensitive", label: "敏感型" },
    { value: "minimalist", label: "极简型" },
    { value: "luxury", label: "奢华型" },
    { value: "ageless", label: "抗老型" },
    { value: "desert", label: "沙漠型" },
    { value: "oily", label: "油性型" },
    { value: "combination", label: "混合型" },
    { value: "guardian", label: "守护型" },
];

function conditionBadges(rule: RecommendationRule) {
    const conditions = rule.conditions as {
        skinType?: string[];
        concern?: string[];
        persona?: string[];
    };
    const items: {
        key: string;
        label: string;
        variant: "secondary" | "primary" | "warning";
    }[] = [];
    conditions.skinType?.forEach((value) =>
        items.push({
            key: `skin-${value}`,
            label:
                SKIN_TYPE_OPTIONS.find((option) => option.value === value)
                    ?.label ?? value,
            variant: "secondary",
        }),
    );
    conditions.concern?.forEach((value) =>
        items.push({
            key: `concern-${value}`,
            label: concernLabel(value),
            variant: "primary",
        }),
    );
    conditions.persona?.forEach((value) =>
        items.push({
            key: `persona-${value}`,
            label:
                PERSONAS.find((option) => option.value === value)?.label ??
                value,
            variant: "warning",
        }),
    );
    return items;
}

export default function RecommendationRulesPage() {
    const toast = useToast();
    const [rules, setRules] = useState<RecommendationRule[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productsTruncated, setProductsTruncated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [role, setRole] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<RecommendationRule | null>(
        null,
    );
    const [submitting, setSubmitting] = useState(false);
    const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
    const [confirmClose, setConfirmClose] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [productCategory, setProductCategory] = useState("all");
    const [onlyNeedsConfig, setOnlyNeedsConfig] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<RecommendationRule | null>(
        null,
    );
    const formSnapshotRef = useRef("");

    const [formName, setFormName] = useState("");
    const [formPriority, setFormPriority] = useState(0);
    const [formMessage, setFormMessage] = useState("");
    const [formActive, setFormActive] = useState(true);
    const [selectedSkinTypes, setSelectedSkinTypes] = useState<string[]>([]);
    const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
    const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    const fetchRules = useCallback(async () => {
        const res = await adminFetch("/api/admin/recommendation-rules");
        if (!res.ok) throw new Error("加载推荐规则失败");
        setRules(await res.json());
    }, []);

    const fetchProducts = useCallback(async () => {
        const res = await adminFetch("/api/admin/products?limit=500");
        if (!res.ok) throw new Error("加载产品失败");
        const data = await res.json();
        const list = data.products || [];
        setProducts(list);
        setProductsTruncated(list.length >= 500);
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            await Promise.all([fetchRules(), fetchProducts()]);
        } catch (error) {
            setLoadError(
                error instanceof Error ? error.message : "加载失败",
            );
        } finally {
            setLoading(false);
        }
    }, [fetchRules, fetchProducts]);

    useEffect(() => {
        loadData();
        adminFetch("/api/admin/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { user?: { role?: string } } | null) => {
                if (data?.user?.role) setRole(data.user.role);
            })
            .catch(() => {});
    }, [loadData]);

    const resetForm = () => {
        setFormName("");
        setFormPriority(0);
        setFormMessage("");
        setFormActive(true);
        setSelectedSkinTypes([]);
        setSelectedConcerns([]);
        setSelectedPersonas([]);
        setSelectedProductIds([]);
        setProductSearch("");
        setProductCategory("all");
        setOnlyNeedsConfig(false);
        setEditingRule(null);
    };

    const snapshotForm = (values: {
        name: string;
        priority: number;
        message: string;
        active: boolean;
        skinTypes: string[];
        concerns: string[];
        personas: string[];
        productIds: string[];
    }) => {
        formSnapshotRef.current = JSON.stringify(values);
    };

    const isFormDirty = () =>
        formSnapshotRef.current !==
        JSON.stringify({
            name: formName,
            priority: formPriority,
            message: formMessage,
            active: formActive,
            skinTypes: selectedSkinTypes,
            concerns: selectedConcerns,
            personas: selectedPersonas,
            productIds: selectedProductIds,
        });

    const closeModal = () => {
        setShowModal(false);
        setConfirmClose(false);
        resetForm();
    };

    const requestCloseModal = () => {
        if (submitting) return;
        if (isFormDirty()) {
            setConfirmClose(true);
            return;
        }
        closeModal();
    };

    const openCreate = () => {
        resetForm();
        snapshotForm({
            name: "",
            priority: 0,
            message: "",
            active: true,
            skinTypes: [],
            concerns: [],
            personas: [],
            productIds: [],
        });
        setShowModal(true);
    };

    const openEdit = (rule: RecommendationRule) => {
        const conditions = rule.conditions as {
            skinType?: string[];
            concern?: string[];
            persona?: string[];
        };
        const skinTypes = conditions.skinType || [];
        const concerns = conditions.concern || [];
        const personas = conditions.persona || [];
        const productIds = rule.productIds || [];
        setEditingRule(rule);
        setFormName(rule.name);
        setFormPriority(rule.priority);
        setFormMessage(rule.message || "");
        setFormActive(rule.active);
        setSelectedSkinTypes(skinTypes);
        setSelectedConcerns(concerns);
        setSelectedPersonas(personas);
        setSelectedProductIds(productIds);
        setProductSearch("");
        setProductCategory("all");
        snapshotForm({
            name: rule.name,
            priority: rule.priority,
            message: rule.message || "",
            active: rule.active,
            skinTypes,
            concerns,
            personas,
            productIds,
        });
        setShowModal(true);
    };

    const toggleSelection = (
        value: string,
        list: string[],
        setList: (values: string[]) => void,
    ) => {
        setList(
            list.includes(value)
                ? list.filter((item) => item !== value)
                : [...list, value],
        );
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formName.trim()) {
            toast.error("请填写规则名称");
            return;
        }
        if (
            selectedSkinTypes.length === 0 &&
            selectedConcerns.length === 0 &&
            selectedPersonas.length === 0
        ) {
            toast.error("请至少选择一个适用条件");
            return;
        }

        setSubmitting(true);
        let saved = false;
        try {
            const body = {
                name: formName.trim(),
                priority: Number(formPriority),
                conditions: {
                    ...(selectedSkinTypes.length > 0 && {
                        skinType: selectedSkinTypes,
                    }),
                    ...(selectedConcerns.length > 0 && {
                        concern: selectedConcerns,
                    }),
                    ...(selectedPersonas.length > 0 && {
                        persona: selectedPersonas,
                    }),
                },
                message: formMessage.trim() || undefined,
                active: formActive,
                productIds: selectedProductIds,
            };
            const url = editingRule
                ? `/api/admin/recommendation-rules/${editingRule.id}`
                : "/api/admin/recommendation-rules";
            const res = await adminFetch(url, {
                method: editingRule ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || "保存失败");
            }
            saved = true;
            closeModal();
            toast.success(editingRule ? "规则已更新" : "规则已创建");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSubmitting(false);
        }

        if (saved) {
            try {
                await fetchRules();
            } catch {
                toast.error("规则已保存，但列表刷新失败，请手动重试");
            }
        }
    };

    const toggleActive = async (rule: RecommendationRule) => {
        if (pendingToggleId) return;
        const previous = rules;
        setPendingToggleId(rule.id);
        setRules((current) =>
            current.map((item) =>
                item.id === rule.id ? { ...item, active: !item.active } : item,
            ),
        );
        try {
            const res = await adminFetch(
                `/api/admin/recommendation-rules/${rule.id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: !rule.active }),
                },
            );
            if (!res.ok) throw new Error("状态更新失败");
        } catch {
            setRules(previous);
            toast.error("状态更新失败，请稍后重试");
        } finally {
            setPendingToggleId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            const res = await adminFetch(
                `/api/admin/recommendation-rules/${deleteTarget.id}`,
                {
                    method: "DELETE",
                },
            );
            if (!res.ok) throw new Error("删除失败");
            setRules((current) =>
                current.filter((item) => item.id !== deleteTarget.id),
            );
            toast.success("规则已删除");
        } catch {
            toast.error("删除失败，请稍后重试");
        } finally {
            setDeleteTarget(null);
        }
    };

    const productCategories = Array.from(
        new Set(products.map((product) => product.category).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const normalizedProductSearch = productSearch.trim().toLowerCase();
    const filteredProducts = products.filter((product) => {
        if (
            productCategory !== "all" &&
            product.category !== productCategory
        ) {
            return false;
        }
        if (
            normalizedProductSearch &&
            !product.name.toLowerCase().includes(normalizedProductSearch)
        ) {
            return false;
        }
        if (onlyNeedsConfig && !needsRecommendationConfig(product)) {
            return false;
        }
        return true;
    });

    const columns: Column<RecommendationRule>[] = [
        {
            key: "name",
            title: "规则",
            render: (_, rule) => (
                <div className="min-w-0">
                    <p
                        className="truncate font-medium text-brand-charcoal"
                        title={rule.name}
                    >
                        {rule.name}
                    </p>
                    {rule.message && (
                        <p
                            className="mt-0.5 truncate text-xs text-brand-charcoal/65"
                            title={rule.message}
                        >
                            {rule.message}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: "priority",
            title: "优先级",
            width: "92px",
            render: (_, rule) => (
                <span className="font-mono text-sm tabular-nums text-brand-charcoal/70">
                    {rule.priority}
                </span>
            ),
        },
        {
            key: "conditions",
            title: "适用条件",
            render: (_, rule) => {
                const items = conditionBadges(rule);
                return items.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {items.map((item) => (
                            <Badge key={item.key} variant={item.variant}>
                                {item.label}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm text-brand-charcoal/55">—</span>
                );
            },
        },
        {
            key: "products",
            title: "关联产品",
            width: "100px",
            render: (_, rule) => (
                <span className="text-sm text-brand-charcoal/70">
                    {rule.productIds.length} 个
                </span>
            ),
        },
        {
            key: "active",
            title: "启用",
            width: "76px",
            render: (_, rule) => (
                <div className="flex items-center gap-1.5">
                    <Switch
                        checked={rule.active}
                        onChange={() => toggleActive(rule)}
                        disabled={pendingToggleId !== null}
                        aria-label={`启用 ${rule.name}`}
                    />
                    {pendingToggleId === rule.id && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-charcoal/50" />
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            title: "操作",
            width: "112px",
            align: "right",
            render: (_, rule) => (
                <div className="flex items-center justify-end gap-0.5">
                    <IconButton
                        label={`编辑 ${rule.name}`}
                        onClick={() => openEdit(rule)}
                    >
                        <Pencil className="h-4 w-4" />
                    </IconButton>
                    {isSuperAdmin(role) && (
                        <IconButton
                            label={`删除 ${rule.name}`}
                            variant="danger"
                            onClick={() => setDeleteTarget(rule)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </IconButton>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <PageHeader
                title="推荐规则"
                description="配置肤质、诉求与人群标签对应的产品推荐优先级"
                actions={
                    <Button
                        size="sm"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={openCreate}
                    >
                        新建规则
                    </Button>
                }
            />

            {loadError && (
                <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                >
                    <span className="min-w-0">{loadError}</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={loadData}
                        loading={loading}
                    >
                        重试
                    </Button>
                </div>
            )}

            {productsTruncated && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    可选产品已达到 500 个上限，更多产品暂时无法在规则中选择。
                </div>
            )}

            <DataTable
                columns={columns}
                tableLayout="fixed"
                minWidth="860px"
                data={rules}
                loading={loading}
                rowKey="id"
                emptyText="暂无推荐规则"
                mobileCard={(rule) => (
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-brand-charcoal">
                                    {rule.name}
                                </p>
                                {rule.message && (
                                    <p className="mt-0.5 truncate text-xs text-brand-charcoal/65">
                                        {rule.message}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Switch
                                    checked={rule.active}
                                    onChange={() => toggleActive(rule)}
                                    disabled={pendingToggleId !== null}
                                    aria-label={`启用 ${rule.name}`}
                                />
                                {pendingToggleId === rule.id && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-charcoal/50" />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {conditionBadges(rule).map((item) => (
                                <Badge key={item.key} variant={item.variant}>
                                    {item.label}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-brand-charcoal/10 pt-2 text-xs text-brand-charcoal/65">
                            <span>
                                优先级 {rule.priority} ·{" "}
                                {rule.productIds.length} 个产品
                            </span>
                            <div className="flex items-center gap-1">
                                <IconButton
                                    label={`编辑 ${rule.name}`}
                                    onClick={() => openEdit(rule)}
                                >
                                    <Pencil className="h-4 w-4" />
                                </IconButton>
                                {isSuperAdmin(role) && (
                                    <IconButton
                                        label={`删除 ${rule.name}`}
                                        variant="danger"
                                        onClick={() => setDeleteTarget(rule)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </IconButton>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            />

            <AdminModal
                isOpen={showModal}
                onClose={requestCloseModal}
                title={editingRule ? "编辑推荐规则" : "新建推荐规则"}
                titleId="recommendation-rule-modal-title"
                subtitle="配置规则条件、优先级与推荐产品"
                maxWidth="lg"
                disabled={submitting}
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                        <Input
                            label="规则名称"
                            value={formName}
                            onChange={(event) =>
                                setFormName(event.target.value)
                            }
                            placeholder="例如：敏感肌修护推荐"
                            required
                        />
                        <Input
                            label="优先级"
                            type="number"
                            value={formPriority}
                            onChange={(event) =>
                                setFormPriority(Number(event.target.value))
                            }
                            hint="数值越大越优先"
                        />
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-brand-charcoal/80">
                            肤质
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {SKIN_TYPE_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    type="button"
                                    size="sm"
                                    variant={
                                        selectedSkinTypes.includes(option.value)
                                            ? "primary"
                                            : "outline"
                                    }
                                    onClick={() =>
                                        toggleSelection(
                                            option.value,
                                            selectedSkinTypes,
                                            setSelectedSkinTypes,
                                        )
                                    }
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-brand-charcoal/80">
                            主要诉求
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {CONCERNS.map((concern) => (
                                <Button
                                    key={concern}
                                    type="button"
                                    size="sm"
                                    variant={
                                        selectedConcerns.includes(concern)
                                            ? "primary"
                                            : "outline"
                                    }
                                    onClick={() =>
                                        toggleSelection(
                                            concern,
                                            selectedConcerns,
                                            setSelectedConcerns,
                                        )
                                    }
                                >
                                    {concernLabel(concern)}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-medium text-brand-charcoal/80">
                            人群标签
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PERSONAS.map((persona) => (
                                <Button
                                    key={persona.value}
                                    type="button"
                                    size="sm"
                                    variant={
                                        selectedPersonas.includes(persona.value)
                                            ? "primary"
                                            : "outline"
                                    }
                                    onClick={() =>
                                        toggleSelection(
                                            persona.value,
                                            selectedPersonas,
                                            setSelectedPersonas,
                                        )
                                    }
                                >
                                    {persona.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Textarea
                        label="推荐语"
                        value={formMessage}
                        onChange={(event) => setFormMessage(event.target.value)}
                        placeholder="向用户展示的推荐说明"
                        rows={3}
                    />

                    <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-brand-charcoal/80">
                                关联产品
                            </p>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-brand-charcoal/65">
                                <input
                                    type="checkbox"
                                    checked={onlyNeedsConfig}
                                    onChange={(event) => setOnlyNeedsConfig(event.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-brand-charcoal/20 text-brand-primary focus:ring-brand-primary"
                                />
                                只看待配置推荐属性
                            </label>
                        </div>
                        <div className="mb-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-charcoal/55" />
                                <Input
                                    aria-label="搜索产品名称"
                                    placeholder="搜索产品名称"
                                    value={productSearch}
                                    onChange={(event) =>
                                        setProductSearch(event.target.value)
                                    }
                                    className="pl-9"
                                />
                            </div>
                            <Select
                                aria-label="按分类筛选产品"
                                options={[
                                    { value: "all", label: "全部分类" },
                                    ...productCategories.map((category) => ({
                                        value: category,
                                        label: category,
                                    })),
                                ]}
                                value={productCategory}
                                onChange={(event) =>
                                    setProductCategory(event.target.value)
                                }
                            />
                        </div>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-brand-charcoal/10 p-2">
                            {products.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-brand-charcoal/55">
                                    暂无产品
                                </p>
                            ) : filteredProducts.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-brand-charcoal/55">
                                    没有匹配的产品
                                </p>
                            ) : (
                                filteredProducts.map((product) => (
                                    <label
                                        key={product.id}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-brand-charcoal/[0.04]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProductIds.includes(
                                                product.id,
                                            )}
                                            onChange={() =>
                                                toggleSelection(
                                                    product.id,
                                                    selectedProductIds,
                                                    setSelectedProductIds,
                                                )
                                            }
                                            className="h-4 w-4 rounded border-brand-charcoal/20 text-brand-primary focus:ring-brand-primary"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-brand-charcoal">
                                            {product.name}
                                        </span>
                                        <span className="text-xs text-brand-charcoal/55">
                                            {product.category}
                                        </span>
                                        <span
                                            className={cn(
                                                "shrink-0 text-xs",
                                                product.active
                                                    ? "text-emerald-600"
                                                    : "text-brand-charcoal/45",
                                            )}
                                        >
                                            {product.active
                                                ? "已上架"
                                                : "已下架"}
                                        </span>
                                    </label>
                                ))
                            )}
                        </div>
                        <p className="mt-1 text-xs text-brand-charcoal/65">
                            已选择 {selectedProductIds.length} 个产品
                            {(normalizedProductSearch ||
                                productCategory !== "all" ||
                                onlyNeedsConfig) &&
                                ` · 当前筛选 ${filteredProducts.length} 个`}
                        </p>
                    </div>

                    <Switch
                        label="启用此规则"
                        checked={formActive}
                        onChange={setFormActive}
                        description="停用后该规则不会参与推荐"
                    />

                    <FormActions>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={requestCloseModal}
                            disabled={submitting}
                        >
                            取消
                        </Button>
                        <Button type="submit" loading={submitting}>
                            {editingRule ? "保存修改" : "创建规则"}
                        </Button>
                    </FormActions>
                </form>
            </AdminModal>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="删除推荐规则"
                message={`确定要删除「${deleteTarget?.name ?? ""}」吗？此操作不可撤销。`}
                confirmText="确认删除"
                variant="danger"
            />

            <ConfirmModal
                isOpen={confirmClose}
                onClose={() => setConfirmClose(false)}
                onConfirm={closeModal}
                title="放弃未保存的修改"
                message="当前规则修改尚未保存，确定要关闭吗？"
                confirmText="放弃修改"
                cancelText="继续编辑"
                variant="warning"
            />
        </div>
    );
}
