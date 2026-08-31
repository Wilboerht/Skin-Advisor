"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, ChevronLeft, ChevronRight, Clock, Loader2, ScanFace } from "lucide-react";

/**
 * TestHistoryList — 测肤记录列表（含数据拉取与分页）
 * 共用方：/profile 测肤记录区块、/diary 测肤记录模态框
 * 数据源：/api/advisor/history（分页、排除冷层归档）
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
  /** 每次数据加载完成后回调（/profile 用它计算统计行） */
  onDataChange?: (sessions: HistorySession[], total: number) => void;
}

function formatRelativeDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export function TestHistoryList({ title, pageSize = 10, onDataChange }: TestHistoryListProps) {
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/advisor/history?page=${page}&limit=${pageSize}`);
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
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base md:text-lg font-semibold text-[#1A1A1A]">{title}</h2>
          {total > 0 && <span className="text-[12px] text-[#8A8A8A]">共 {total} 条</span>}
        </div>
      )}

      {loading ? (
        <div className="h-48 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-5 h-5 text-[#C9A86C] animate-spin" />
          <span className="text-[13px] text-[#8A8A8A]">加载记录中...</span>
        </div>
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-[#8A8A8A]">测肤记录加载失败，请检查网络后重试</p>
          <button
            type="button"
            onClick={fetchHistory}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-[#1B3A5C] border border-[#1B3A5C]/20 hover:border-[#1B3A5C]/40 hover:bg-[#1B3A5C]/[0.04] transition-all duration-300"
          >
            重新加载
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-14 md:py-20">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-[rgba(61,68,48,0.06)] flex items-center justify-center text-[#C9A86C]">
            <Clock className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <h3 className="text-[15px] font-medium text-[#1A1A1A] mb-1.5">暂无测肤记录</h3>
          <p className="text-[13px] text-[#8A8A8A] mb-5">开始第一次 AI 皮肤分析</p>
          <Link
            href="/questions"
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] text-[#1B3A5C] border border-[#1B3A5C]/20 hover:border-[#1B3A5C]/40 hover:bg-[#1B3A5C]/[0.04] transition-all duration-300"
          >
            <ScanFace className="w-3.5 h-3.5" />
            立即测肤
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((session) => {
            const result = session.analysisResult;
            const score = result?.faceAnalysis?.overallScore;
            const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
            const concerns = result?.skinProfile?.concerns || result?.concerns || [];
            const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;

            return (
              <Link
                key={session.sessionId}
                href={`/reports/${session.sessionId}`}
                className="group block bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(61,68,48,0.04)] hover:shadow-[0_4px_20px_rgba(61,68,48,0.08)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[rgba(61,68,48,0.06)] flex items-center justify-center text-[#3D4430]">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[14px] font-medium text-[#1A1A1A]">
                        {skinType || "肌肤分析"}
                      </div>
                      <div className="text-[12px] text-[#8A8A8A]">{formatRelativeDate(session.completedAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[#1A1A1A]">
                    <span className="text-lg font-semibold">{score ?? "—"}</span>
                    {score != null && <span className="text-[11px] text-[#8A8A8A]">分</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {concerns.slice(0, 3).map((c, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 text-[11px] rounded-full bg-[rgba(61,68,48,0.08)] text-[#5E5E5E]"
                    >
                      {c}
                    </span>
                  ))}
                  {concerns.length > 3 && (
                    <span className="text-[11px] text-[#8A8A8A]">+{concerns.length - 3}</span>
                  )}
                  {skinAge != null && skinAge > 0 && (
                    <span className="text-[11px] text-[#8A8A8A]">肤龄 {skinAge}</span>
                  )}
                </div>

                <div className="mt-4 flex items-center text-[12px] text-[#1B3A5C] font-medium">
                  <span>查看报告</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
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
            className="flex items-center gap-1.5 text-[12px] text-[#8A8A8A] hover:text-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </button>

          <span className="text-[12px] text-[#8A8A8A]">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1.5 text-[12px] text-[#8A8A8A] hover:text-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
