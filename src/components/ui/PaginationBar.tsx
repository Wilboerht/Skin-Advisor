"use client";

import { Pagination } from "@/components/ui/Pagination";

interface PaginationBarProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
    className?: string;
    total?: number;
    limit?: number;
    pageSizeOptions?: number[];
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
}

export function PaginationBar({
    page,
    totalPages,
    onPageChange,
    className,
    total,
    limit,
    pageSize,
    onPageSizeChange,
}: PaginationBarProps) {
    const resolvedPageSize = pageSize ?? limit ?? 10;
    const resolvedTotal = total ?? totalPages * resolvedPageSize;
    if (resolvedTotal <= 0) return null;

    return (
        <Pagination
            page={page}
            pageSize={resolvedPageSize}
            total={resolvedTotal}
            onChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            className={className}
        />
    );
}
