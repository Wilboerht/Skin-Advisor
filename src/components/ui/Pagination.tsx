"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Select } from "./Select";

interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onChange: (page: number) => void;
    showTotal?: boolean;
    className?: string;
    /** 每页条数选择（可选）。传了 onPageSizeChange 才显示选择器 */
    onPageSizeChange?: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100].map((size) => ({
    value: String(size),
    label: String(size),
}));

function PageSizeSelect({
    pageSize,
    onPageSizeChange,
}: {
    pageSize: number;
    onPageSizeChange: (pageSize: number) => void;
}) {
    return (
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            每页
            <span className="inline-block w-[76px]">
                <Select
                    aria-label="每页条数"
                    options={PAGE_SIZE_OPTIONS}
                    value={String(pageSize)}
                    onChange={(event) =>
                        onPageSizeChange(Number(event.target.value))
                    }
                />
            </span>
            条
        </label>
    );
}

/**
 * shadcn/ui 分页：统一 Button / Select / 语义色
 */
export function Pagination({
    page,
    pageSize,
    total,
    onChange,
    showTotal = true,
    className,
    onPageSizeChange,
}: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize);

    const pageNumbers: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
        pageNumbers.push(1);
        if (page > 3) pageNumbers.push("ellipsis");
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        for (let i = start; i <= end; i++) pageNumbers.push(i);
        if (page < totalPages - 2) pageNumbers.push("ellipsis");
        pageNumbers.push(totalPages);
    }

    if (totalPages <= 1) {
        if (!onPageSizeChange && !showTotal) return null;
        return (
            <div className={cn("flex flex-wrap items-center gap-3", className)}>
                {showTotal && (
                    <span className="text-sm text-muted-foreground">
                        共 {total} 条
                    </span>
                )}
                {onPageSizeChange && (
                    <PageSizeSelect
                        pageSize={pageSize}
                        onPageSizeChange={onPageSizeChange}
                    />
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex flex-wrap items-center justify-between gap-3",
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-3">
                {showTotal && (
                    <span className="text-sm text-muted-foreground">
                        共 {total} 条
                    </span>
                )}
                {onPageSizeChange && (
                    <PageSizeSelect
                        pageSize={pageSize}
                        onPageSizeChange={onPageSizeChange}
                    />
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 sm:hidden">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onChange(page - 1)}
                        disabled={page === 1}
                        aria-label="上一页"
                    >
                        <ChevronLeft />
                    </Button>
                    <span className="min-w-16 text-center text-sm text-muted-foreground tabular-nums">
                        {page}/{totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onChange(page + 1)}
                        disabled={page === totalPages}
                        aria-label="下一页"
                    >
                        <ChevronRight />
                    </Button>
                </div>

                <div className="hidden items-center gap-1 sm:flex">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onChange(page - 1)}
                        disabled={page === 1}
                        aria-label="上一页"
                    >
                        <ChevronLeft />
                    </Button>

                    {pageNumbers.map((item, index) =>
                        item === "ellipsis" ? (
                            <span
                                key={`ellipsis-${index}`}
                                aria-hidden="true"
                                className="flex size-9 items-center justify-center text-muted-foreground"
                            >
                                <MoreHorizontal className="size-4" />
                            </span>
                        ) : (
                            <Button
                                key={item}
                                variant={
                                    page === item ? "default" : "ghost"
                                }
                                size="icon"
                                onClick={() => onChange(item)}
                                aria-current={
                                    page === item ? "page" : undefined
                                }
                                aria-label={`第 ${item} 页`}
                                className="tabular-nums"
                            >
                                {item}
                            </Button>
                        ),
                    )}

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onChange(page + 1)}
                        disabled={page === totalPages}
                        aria-label="下一页"
                    >
                        <ChevronRight />
                    </Button>
                </div>
            </div>
        </div>
    );
}
