"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { isSuperAdmin } from "@/lib/permissions";
import { SKIN_TYPE_OPTIONS } from "@/types/product";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    "dark spots",
    "redness",
    "pores",
    "dullness",
    "blackheads",
    "dryness",
];

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
            label: value,
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
    const [role, setRole] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState<RecommendationRule | null>(
        null,
    );
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<RecommendationRule | null>(
        null,
    );

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

    useEffect(() => {
        Promise.all([fetchRules(), fetchProducts()])
            .catch((error) =>
                toast.error(
                    error instanceof Error ? error.message : "加载失败",
                ),
            )
            .finally(() => setLoading(false));
        adminFetch("/api/admin/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { user?: { role?: string } } | null) => {
                if (data?.user?.role) setRole(data.user.role);
            })
            .catch(() => {});
    }, [fetchRules, fetchProducts, toast]);

    const resetForm = () => {
        setFormName("");
        setFormPriority(0);
        setFormMessage("");
        setFormActive(true);
        setSelectedSkinTypes([]);
        setSelectedConcerns([]);
        setSelectedPersonas([]);
        setSelectedProductIds([]);
        setEditingRule(null);
    };

    const openCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = (rule: RecommendationRule) => {
        const conditions = rule.conditions as {
            skinType?: string[];
            concern?: string[];
            persona?: string[];
        };
        setEditingRule(rule);
        setFormName(rule.name);
        setFormPriority(rule.priority);
        setFormMessage(rule.message || "");
        setFormActive(rule.active);
        setSelectedSkinTypes(conditions.skinType || []);
        setSelectedConcerns(conditions.concern || []);
        setSelectedPersonas(conditions.persona || []);
        setSelectedProductIds(rule.productIds || []);
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
            setShowModal(false);
            resetForm();
            toast.success(editingRule ? "规则已更新" : "规则已创建");
            await fetchRules();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSubmitting(false);
        }
    };

    const toggleActive = async (rule: RecommendationRule) => {
        const previous = rules;
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
                <Switch
                    checked={rule.active}
                    onChange={() => toggleActive(rule)}
                    aria-label={`启用 ${rule.name}`}
                />
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
                            <Switch
                                checked={rule.active}
                                onChange={() => toggleActive(rule)}
                                aria-label={`启用 ${rule.name}`}
                            />
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
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
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
                                    {concern}
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
                        <p className="mb-2 text-sm font-medium text-brand-charcoal/80">
                            关联产品
                        </p>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-brand-charcoal/10 p-2">
                            {products.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-brand-charcoal/55">
                                    暂无产品
                                </p>
                            ) : (
                                products.map((product) => (
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
                                    </label>
                                ))
                            )}
                        </div>
                        <p className="mt-1 text-xs text-brand-charcoal/65">
                            已选择 {selectedProductIds.length} 个产品
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
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
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
        </div>
    );
}
