"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /** Show detailed record count like "Showing x to y of z" */
  total?: number;
  limit?: number;
  /** Page size selector options */
  pageSizeOptions?: number[];
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  total,
  limit,
  pageSizeOptions,
  pageSize,
  onPageSizeChange,
}: PaginationBarProps) {
  if (totalPages <= 1 && !pageSizeOptions) return null;

  const startRecord = total !== undefined && limit ? (page - 1) * limit + 1 : null;
  const endRecord = total !== undefined && limit ? Math.min(page * limit, total) : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 pt-4",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {startRecord && endRecord && total ? (
          <span>
            第 {startRecord} 到 {endRecord} 条，共 {total} 条
          </span>
        ) : (
          <span>共 {total} 条</span>
        )}
        {pageSizeOptions && pageSize && onPageSizeChange && (
          <>
            <span className="text-slate-300">|</span>
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="每页条数"
              className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>条</span>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || disabled}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600 min-w-[4rem] text-center tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || disabled}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
