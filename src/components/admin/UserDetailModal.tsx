"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Clock,
    Loader2,
    Settings,
    Smartphone,
    User as UserIcon,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/components/ui/Toast";
import { AdminModal } from "@/components/ui/AdminModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Input";
import { isDisabledUser } from "@/lib/permissions";

interface UserDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    onUpdate?: () => void;
}

interface SessionSummary {
    createdAt: string;
    deviceType?: string | null;
    province?: string | null;
    completedAt?: string | null;
}

interface UserDetail {
    id: string;
    email: string;
    phoneNumber?: string;
    name: string | null;
    role: string;
    dailyTestLimit: number;
    createdAt: string;
    advisorSessions: SessionSummary[];
    _count?: {
        testRecords?: number;
    };
}

const ROLE_LABELS: Record<string, string> = {
    super_admin: "超级管理员",
    admin: "管理员",
    user: "普通用户",
    disabled: "已禁用",
};

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function UserDetailModal({
    isOpen,
    onClose,
    userId,
    onUpdate,
}: UserDetailModalProps) {
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState("");
    const [editingLimit, setEditingLimit] = useState(false);
    const [newLimit, setNewLimit] = useState(10);
    const [saving, setSaving] = useState(false);
    const [limitDirty, setLimitDirty] = useState(false);
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const toast = useToast();
    const abortRef = useRef<AbortController | null>(null);

    const fetchUserDetails = useCallback(() => {
        if (!userId) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setFetchError("");
        adminFetch(`/api/admin/users/${userId}`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                setUser(data);
                setNewLimit(data.dailyTestLimit ?? 10);
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                setUser(null);
                setFetchError("加载用户详情失败，请稍后重试");
            })
            .finally(() => {
                if (abortRef.current === controller) abortRef.current = null;
                setLoading(false);
            });
    }, [userId]);

    useEffect(() => {
        if (isOpen && userId) {
            fetchUserDetails();
        } else {
            abortRef.current?.abort();
            abortRef.current = null;
            setUser(null);
            setFetchError("");
            setEditingLimit(false);
            setLimitDirty(false);
        }
        return () => abortRef.current?.abort();
    }, [isOpen, userId, fetchUserDetails]);

    const handleSaveLimit = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const res = await adminFetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dailyTestLimit: newLimit }),
            });
            if (!res.ok) throw new Error("保存失败");
            const updated = await res.json();
            setUser({ ...user, dailyTestLimit: updated.dailyTestLimit });
            setEditingLimit(false);
            setLimitDirty(false);
            toast.success("每日测试额度已更新");
            onUpdate?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleClose = useCallback(() => {
        if (limitDirty) {
            setShowUnsavedConfirm(true);
            return;
        }
        onClose();
    }, [limitDirty, onClose]);

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={handleClose}
            title="用户详情"
            titleId="user-detail-modal-title"
            subtitle={user?.email || user?.phoneNumber || undefined}
            maxWidth="lg"
            headerIcon={
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                    <UserIcon className="h-5 w-5" />
                </div>
            }
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-7 w-7 animate-spin text-brand-primary" />
                    <p className="mt-3 text-sm text-brand-charcoal/65">
                        正在加载用户详情...
                    </p>
                </div>
            ) : fetchError ? (
                <Empty
                    title="加载用户详情失败"
                    description={fetchError}
                    className="py-10"
                    action={
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchUserDetails}
                        >
                            重试
                        </Button>
                    }
                />
            ) : !user ? (
                <Empty title="用户不存在" className="py-10" />
            ) : (
                <div className="space-y-5">
                    <div className="rounded-xl border border-brand-charcoal/10 bg-brand-charcoal/[0.02] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-semibold text-brand-charcoal">
                                    {user.name || "未命名用户"}
                                </h2>
                                <p className="mt-1 truncate text-sm text-brand-charcoal/65">
                                    {user.email || user.phoneNumber || "—"}
                                </p>
                            </div>
                            <Badge
                                variant={
                                    isDisabledUser(user.role)
                                        ? "danger"
                                        : "success"
                                }
                            >
                                {isDisabledUser(user.role) ? "已禁用" : "活跃"}
                            </Badge>
                        </div>
                        <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-brand-charcoal/10 pt-4 text-sm sm:grid-cols-2">
                            <div className="min-w-0">
                                <dt className="text-xs text-brand-charcoal/65">
                                    账号角色
                                </dt>
                                <dd className="mt-0.5 text-brand-charcoal">
                                    {ROLE_LABELS[user.role] || user.role || "—"}
                                </dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-xs text-brand-charcoal/65">
                                    注册时间
                                </dt>
                                <dd className="mt-0.5 text-brand-charcoal">
                                    {formatDateTime(user.createdAt)}
                                </dd>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                                <dt className="text-xs text-brand-charcoal/65">
                                    用户 ID
                                </dt>
                                <dd
                                    className="mt-0.5 truncate font-mono text-xs text-brand-charcoal/70"
                                    title={user.id}
                                >
                                    {user.id}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <section className="rounded-xl border border-brand-charcoal/10 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
                                    <Settings className="h-4 w-4 text-brand-charcoal/65" />
                                    每日测试额度
                                </h3>
                                <p className="mt-1 text-xs text-brand-charcoal/65">
                                    系统默认 10
                                    次；自定义值会覆盖会员默认额度，0
                                    表示禁止测试。
                                </p>
                            </div>
                            {editingLimit ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        type="number"
                                        min={0}
                                        max={9999}
                                        value={newLimit}
                                        onChange={(event) => {
                                            const next = Number(
                                                event.target.value,
                                            );
                                            setNewLimit(
                                                Number.isFinite(next)
                                                    ? Math.max(
                                                          0,
                                                          Math.min(
                                                              9999,
                                                              Math.trunc(next),
                                                          ),
                                                      )
                                                    : 0,
                                            );
                                            setLimitDirty(true);
                                        }}
                                        className="w-24"
                                        aria-label="每日测试额度"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleSaveLimit}
                                        loading={saving}
                                    >
                                        保存
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setEditingLimit(false);
                                            setNewLimit(
                                                user.dailyTestLimit ?? 10,
                                            );
                                            setLimitDirty(false);
                                        }}
                                        disabled={saving}
                                    >
                                        取消
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-xl font-semibold tabular-nums text-brand-charcoal">
                                        {user.dailyTestLimit ?? 10}
                                    </span>
                                    <span className="text-sm text-brand-charcoal/65">
                                        次/天
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingLimit(true)}
                                    >
                                        修改
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-xl border border-brand-charcoal/10 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-medium text-brand-charcoal">
                                <Clock className="h-4 w-4 text-brand-charcoal/65" />
                                最近测肤
                            </h3>
                            <span className="text-xs text-brand-charcoal/65">
                                共{" "}
                                {user._count?.testRecords ??
                                    user.advisorSessions.length}{" "}
                                次
                            </span>
                        </div>
                        {user.advisorSessions.length === 0 ? (
                            <Empty title="暂无测肤记录" className="py-6" />
                        ) : (
                            <div className="divide-y divide-brand-charcoal/[0.06]">
                                {user.advisorSessions
                                    .slice(0, 5)
                                    .map((session) => (
                                        <div
                                            key={`${session.createdAt}-${session.completedAt ?? "pending"}`}
                                            className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm text-brand-charcoal">
                                                    {formatDateTime(
                                                        session.createdAt,
                                                    )}
                                                </p>
                                                <p className="mt-0.5 flex items-center gap-1 text-xs text-brand-charcoal/65">
                                                    {session.deviceType ===
                                                    "mobile" ? (
                                                        <Smartphone className="h-3 w-3" />
                                                    ) : (
                                                        "桌面端"
                                                    )}
                                                    <span>·</span>
                                                    {session.province ||
                                                        "未知位置"}
                                                </p>
                                            </div>
                                            <Badge
                                                variant={
                                                    session.completedAt
                                                        ? "success"
                                                        : "warning"
                                                }
                                            >
                                                {session.completedAt
                                                    ? "已完成"
                                                    : "进行中"}
                                            </Badge>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <ConfirmModal
                isOpen={showUnsavedConfirm}
                onClose={() => setShowUnsavedConfirm(false)}
                onConfirm={() => {
                    setShowUnsavedConfirm(false);
                    setLimitDirty(false);
                    onClose();
                }}
                title="未保存的修改"
                message="测试额度尚未保存，确定要关闭吗？"
                confirmText="放弃修改"
                cancelText="继续编辑"
                variant="warning"
            />
        </AdminModal>
    );
}
