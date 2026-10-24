"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    Download,
    Eye,
    Info,
    Search,
    Shield,
    ShieldOff,
    Trash2,
    User as UserIcon,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { isDisabledUser, isSuperAdmin } from "@/lib/permissions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
    DataTable,
    IconButton,
    PageHeader,
    PanelCard,
    type Column,
} from "@/components/admin";
import { Tooltip } from "@/components/ui/Tooltip";
import { UserDetailModal } from "./UserDetailModal";

interface User {
    id: string;
    email: string;
    name: string | null;
    role: string;
    previousRole?: string | null;
    createdAt: string;
    _count: {
        advisorSessions: number;
    };
    advisorSessions: {
        createdAt: string;
        completedAt: string | null;
    }[];
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const STATUS_OPTIONS = [
    { value: "all", label: "所有用户状态" },
    { value: "active", label: "活跃用户" },
    { value: "inactive", label: "已禁用" },
];

function formatDate(value: string) {
    return new Date(value).toLocaleDateString("zh-CN");
}

export function UsersClient({
    role,
    initialUserId = null,
}: {
    role: string;
    initialUserId?: string | null;
}) {
    const toast = useToast();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const canManageDeletion = isSuperAdmin(role);

    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20) || 20;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const [searchInput, setSearchInput] = useState(search);
    const [prevSearch, setPrevSearch] = useState(search);
    if (prevSearch !== search) {
        setPrevSearch(search);
        setSearchInput(search);
    }

    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<PaginationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmToggle, setConfirmToggle] = useState<{
        user: User;
        isDisabling: boolean;
    } | null>(null);
    const [detailUser, setDetailUser] = useState<string | null>(initialUserId);
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

    const fetchUsers = useCallback(async () => {
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
            const res = await adminFetch(`/api/admin/users?${params}`, {
                signal: controller.signal,
            });
            if (!res.ok) throw new Error("加载用户列表失败");
            const data = await res.json();
            setUsers(data.users);
            setPagination(data.pagination);
            setLoadError("");
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") return;
            setLoadError(
                error instanceof Error ? error.message : "加载用户列表失败",
            );
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setLoading(false);
        }
    }, [page, pageSize, search, status]);

    useEffect(() => {
        fetchUsers();
        return () => abortRef.current?.abort();
    }, [fetchUsers]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput === search) return;
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

    const performToggleStatus = async (user: User, isDisabling: boolean) => {
        setActionLoading(true);
        try {
            const res = await adminFetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    isDisabling ? { role: "disabled" } : { role: "user" },
                ),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || "操作失败");
            }
            await fetchUsers();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "操作失败");
        } finally {
            setActionLoading(false);
            setConfirmToggle(null);
        }
    };

    const handleToggleStatus = (user: User) => {
        const isDisabling = !isDisabledUser(user.role);
        if (isDisabling || user.previousRole) {
            setConfirmToggle({ user, isDisabling });
            return;
        }
        void performToggleStatus(user, false);
    };

    const handleDelete = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            const res = await adminFetch(
                `/api/admin/users/${selectedUser.id}`,
                {
                    method: "DELETE",
                },
            );
            if (!res.ok) throw new Error("删除失败");
            setShowDeleteModal(false);
            setSelectedUser(null);
            await fetchUsers();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除失败");
        } finally {
            setActionLoading(false);
        }
    };

    const columns: Column<User>[] = [
        {
            key: "name",
            title: "用户",
            render: (_, user) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-charcoal/[0.04] text-brand-charcoal/65">
                        <UserIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p
                            className="truncate font-medium text-brand-charcoal"
                            title={user.name || "未命名用户"}
                        >
                            {user.name || "未命名用户"}
                        </p>
                        <p
                            className="truncate text-xs text-brand-charcoal/65"
                            title={user.email}
                        >
                            {user.email}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: "role",
            title: "状态",
            width: "120px",
            render: (_, user) => (
                <Badge
                    variant={isDisabledUser(user.role) ? "danger" : "success"}
                >
                    {isDisabledUser(user.role) ? "已禁用" : "活跃"}
                </Badge>
            ),
        },
        {
            key: "createdAt",
            title: "注册时间",
            width: "120px",
            render: (_, user) => (
                <span className="whitespace-nowrap text-sm text-brand-charcoal/70">
                    {formatDate(user.createdAt)}
                </span>
            ),
        },
        {
            key: "lastActive",
            title: "最近活跃",
            width: "120px",
            render: (_, user) => (
                <span className="whitespace-nowrap text-sm text-brand-charcoal/70">
                    {user.advisorSessions[0]
                        ? formatDate(user.advisorSessions[0].createdAt)
                        : "—"}
                </span>
            ),
        },
        {
            key: "sessions",
            title: "测试次数",
            width: "96px",
            align: "right",
            render: (_, user) => (
                <span className="font-mono text-sm tabular-nums text-brand-charcoal">
                    {user._count.advisorSessions}
                </span>
            ),
        },
        {
            key: "actions",
            title: "操作",
            width: "132px",
            align: "right",
            render: (_, user) => (
                <div className="flex items-center justify-end gap-0.5">
                    <Tooltip content="查看详情" side="top">
                        <IconButton
                            label={`查看 ${user.name || user.email} 详情`}
                            onClick={() => setDetailUser(user.id)}
                        >
                            <Eye className="h-4 w-4" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip
                        content={
                            isDisabledUser(user.role) ? "启用用户" : "禁用用户"
                        }
                        side="top"
                    >
                        <IconButton
                            label={`${isDisabledUser(user.role) ? "启用" : "禁用"} ${user.name || user.email}`}
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoading}
                        >
                            {isDisabledUser(user.role) ? (
                                <Shield className="h-4 w-4" />
                            ) : (
                                <ShieldOff className="h-4 w-4" />
                            )}
                        </IconButton>
                    </Tooltip>
                    {canManageDeletion && (
                        <Tooltip content="删除用户" side="top">
                            <IconButton
                                label={`删除 ${user.name || user.email}`}
                                variant="danger"
                                onClick={() => {
                                    setSelectedUser(user);
                                    setShowDeleteModal(true);
                                }}
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
                title="用户管理"
                description={`管理测肤子站注册用户${pagination ? ` · 共 ${pagination.total} 人` : ""}`}
                actions={
                    canManageDeletion ? (
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Download className="h-4 w-4" />}
                            onClick={() =>
                                window.open(
                                    "/api/admin/export?type=users",
                                    "_blank",
                                )
                            }
                        >
                            导出用户
                        </Button>
                    ) : undefined
                }
            />

            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                    此处的「禁用」和「删除」仅作用于测肤子站，不会同步到 NIHPLOD
                    主站。被禁用的用户仍可登录主站，但无法在子站使用测肤、查看历史记录等功能。
                </p>
            </div>

            <PanelCard>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <form
                        className="relative w-full md:max-w-sm md:flex-1"
                        onSubmit={(event) => {
                            event.preventDefault();
                            updateParams({ search: searchInput || null });
                        }}
                    >
                        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-charcoal/65" />
                        <Input
                            aria-label="搜索用户姓名、邮箱或手机号"
                            placeholder="搜索姓名 / 邮箱 / 手机号"
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                            className="pl-10"
                        />
                    </form>

                    <div className="w-full sm:w-44">
                        <Select
                            aria-label="按用户状态筛选"
                            options={STATUS_OPTIONS}
                            value={status}
                            onChange={(event) =>
                                updateParams({ status: event.target.value })
                            }
                        />
                    </div>

                    <span className="text-sm text-brand-charcoal/65 md:ml-auto">
                        {loading
                            ? "加载中..."
                            : `共 ${pagination?.total ?? 0} 位用户`}
                    </span>
                </div>
            </PanelCard>

            {loadError ? (
                <PanelCard>
                    <Empty
                        title="加载用户列表失败"
                        description={loadError}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchUsers}
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
                        minWidth="860px"
                        data={users}
                        loading={loading}
                        rowKey="id"
                        emptyText={
                            search ? `没有匹配「${search}」的用户` : "暂无用户"
                        }
                        mobileCard={(user) => (
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-brand-charcoal">
                                            {user.name || "未命名用户"}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-brand-charcoal/65">
                                            {user.email}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            isDisabledUser(user.role)
                                                ? "danger"
                                                : "success"
                                        }
                                    >
                                        {isDisabledUser(user.role)
                                            ? "已禁用"
                                            : "活跃"}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-brand-charcoal/65">
                                    <span>
                                        注册：{formatDate(user.createdAt)}
                                    </span>
                                    <span>
                                        测试 {user._count.advisorSessions} 次
                                    </span>
                                    <span>
                                        最近活跃：
                                        {user.advisorSessions[0]
                                            ? formatDate(
                                                  user.advisorSessions[0]
                                                      .createdAt,
                                              )
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-end gap-1 border-t border-brand-charcoal/10 pt-2">
                                    <IconButton
                                        label={`查看 ${user.name || user.email} 详情`}
                                        onClick={() => setDetailUser(user.id)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </IconButton>
                                    <IconButton
                                        label={`${isDisabledUser(user.role) ? "启用" : "禁用"} ${user.name || user.email}`}
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={actionLoading}
                                    >
                                        {isDisabledUser(user.role) ? (
                                            <Shield className="h-4 w-4" />
                                        ) : (
                                            <ShieldOff className="h-4 w-4" />
                                        )}
                                    </IconButton>
                                    {canManageDeletion && (
                                        <IconButton
                                            label={`删除 ${user.name || user.email}`}
                                            variant="danger"
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                    )}
                                </div>
                            </div>
                        )}
                    />

                    {pagination && pagination.totalPages > 1 && (
                        <Pagination
                            page={pagination.page}
                            pageSize={pagination.limit}
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

            <UserDetailModal
                isOpen={!!detailUser}
                onClose={() => setDetailUser(null)}
                userId={detailUser}
                onUpdate={fetchUsers}
            />

            <ConfirmModal
                isOpen={!!confirmToggle}
                onClose={() => setConfirmToggle(null)}
                onConfirm={() =>
                    confirmToggle
                        ? performToggleStatus(
                              confirmToggle.user,
                              confirmToggle.isDisabling,
                          )
                        : Promise.resolve()
                }
                title={confirmToggle?.isDisabling ? "禁用用户" : "启用用户"}
                message={
                    confirmToggle?.isDisabling
                        ? `确定要禁用「${confirmToggle.user.name || confirmToggle.user.email}」吗？禁用后该用户无法继续使用测肤子站功能，但不影响主站账号。`
                        : `确定要启用「${confirmToggle?.user.name || confirmToggle?.user.email}」吗？`
                }
                confirmText={
                    confirmToggle?.isDisabling ? "确认禁用" : "确认启用"
                }
                variant={confirmToggle?.isDisabling ? "danger" : "default"}
                loading={actionLoading}
            />

            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setSelectedUser(null);
                }}
                onConfirm={handleDelete}
                title="删除用户"
                message={`确定要删除「${selectedUser?.name || selectedUser?.email || ""}」吗？此操作仅清除子站本地数据，不会删除主站账号。`}
                confirmText="确认删除"
                variant="danger"
                loading={actionLoading}
            />
        </div>
    );
}
