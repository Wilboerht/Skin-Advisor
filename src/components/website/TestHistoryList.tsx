"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Loader2, ScanFace } from "lucide-react";

/**
 * TestHistoryList — 测肤记录列表（含数据拉取与分页）
 * 使用方：护肤档案弹层（DiaryModal）测肤记录模态框
 * 数据源：/api/advisor/history（分页、排除冷层归档）
 * 条目为一行紧凑式：日期 · 肤质 · 分数，点击进入报告详情
 */

export interface HistoryAnalysisResult {
  faceAnalysis?: { overallScore?: number; skinAge?: number };
  skinProfile?: { type?: string; typeLabel?: string; concerns?: string[]; skinAge?: number };
  skinType?: { typeLabel?: string };
  concerns?: string[];
}

export interface HistorySession {
  sessionId: string;
  completedAt: string;
  analysisResult?: HistoryAnalysisResult;
}

interface TestHistoryListProps {
  /** 传入时显示内置标题栏（标题 + 共 N 条）；模态框场景可不传（模态框自带标题） */
  title?: string;
  pageSize?: number;
  /** 提供非空首屏数据时跳过初始拉取（需与 pageSize 对齐），避免重复请求同一接口 */
  initialSessions?: HistorySession[];
  /** 首屏数据对应的服务端总条数（配合 initialSessions 使用） */
  initialTotal?: number;
  /** 初始页码（配合父级保留翻页位置） */
  initialPage?: number;
  /** 翻页回调（父级保存当前位置，重新进入时恢复） */
  onPageChange?: (page: number) => void;
  /** 每次数据加载完成后回调 */
  onDataChange?: (sessions: HistorySession[], total: number) => void;
}

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function TestHistoryList({
  title,
  pageSize = 10,
  initialSessions,
  initialTotal = 0,
  initialPage,
  onPageChange,
  onDataChange,
}: TestHistoryListProps) {
  const hasInitial = !!initialSessions && initialSessions.length > 0;
  const [history, setHistory] = useState<HistorySession[]>(initialSessions ?? []);
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialTotal > 0 ? Math.ceil(initialTotal / pageSize) : 0);
  const [total, setTotal] = useState(initialTotal);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/advisor/history?page=${page}&limit=${pageSize}&lite=1`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sessions: HistorySession[] = data.history ?? [];
      const totalCount: number = data.pagination?.total || 0;
      setHistory(sessions);
      setTotalPages(data.pagination?.totalPages || 0);
      setTotal(totalCount);
      onDataChange?.(sessions, totalCount);
    } catch (e) {
      console.error("History fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, onDataChange]);

  useEffect(() => {
    // 已提供首屏数据：跳过初始拉取，避免与父级（DiaryModal 时间线）重复请求
    if (hasInitial) return;
    fetchHistory();
  }, [fetchHistory, hasInitial]);

  useEffect(() => {
    onPageChange?.(page);
  }, [page, onPageChange]);

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base md:text-lg font-medium text-brand-charcoal">{title}</h2>
          {total > 0 && <span className="text-[12px] text-brand-charcoal/45">共 {total} 条</span>}
        </div>
      )}

      {loading ? (
        <div className="h-48 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-5 h-5 text-brand-charcoal/30 animate-spin" />
          <span className="text-[13px] text-brand-charcoal/45">加载记录中...</span>
        </div>
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-brand-charcoal/45">测肤记录加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={fetchHistory}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-[var(--color-brand-cocoa)] border border-brand-espresso/20 hover:border-brand-espresso/50 hover:bg-brand-espresso/[0.04] transition-all duration-300"
          >
            重新加载
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-14 md:py-20">
          <Clock className="w-7 h-7 mx-auto mb-3 text-brand-charcoal/25" strokeWidth={1.5} />
          <h3 className="text-[15px] font-medium text-brand-charcoal mb-1.5">暂无测肤记录</h3>
          <p className="text-[13px] text-brand-charcoal/45 mb-5">开始第一次 AI 皮肤分析</p>
          <Link
            href="/questions"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-[var(--color-brand-cocoa)] border border-brand-espresso/20 hover:border-brand-espresso/50 hover:bg-brand-espresso/[0.04] transition-all duration-300"
          >
            <ScanFace className="w-3.5 h-3.5" />
            立即测肤
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-brand-espresso/[0.06]">
          {history.map((session) => {
            const result = session.analysisResult;
            const score = result?.faceAnalysis?.overallScore;
            const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;

            return (
              <Link
                key={session.sessionId}
                href={`/reports/${session.sessionId}`}
                className="group flex items-center gap-3 px-1 py-3 rounded-md hover:bg-brand-charcoal/[0.03] transition-colors"
              >
                <span className="shrink-0 w-12 text-[13px] text-brand-charcoal/45 font-light tabular-nums">
                  {formatDay(session.completedAt)}
                </span>
                <span className="flex-1 min-w-0 truncate text-[13px] text-brand-charcoal/85">
                  {skinType || "肌肤分析"}
                </span>
                <span className="shrink-0 text-[13px] font-medium text-brand-charcoal tabular-nums">
                  {score != null && score > 0 ? `${score} 分` : "—"}
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-brand-charcoal/25 group-hover:text-brand-charcoal/60 group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1.5 text-[12px] text-brand-charcoal/45 hover:text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </button>

          <span className="text-[12px] text-brand-charcoal/45">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1.5 text-[12px] text-brand-charcoal/45 hover:text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
