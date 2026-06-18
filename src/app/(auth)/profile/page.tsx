"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "next-view-transitions";
import {
  ArrowLeft,
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ScanFace,
  LogOut,
  Sparkles,
  TrendingUp,
  Award,
  Calendar
} from "lucide-react";
import { m } from "framer-motion";
import Image from "next/image";

interface AnalysisResult {
  faceAnalysis?: { overallScore?: number; skinAge?: number };
  skinProfile?: { typeLabel?: string; concerns?: string[]; skinAge?: number };
  skinType?: { typeLabel?: string };
  concerns?: string[];
  generatedAvatar?: string;
}

interface HistorySession {
  sessionId: string;
  completedAt: string;
  analysisResult?: AnalysisResult;
}

const concernPalette = [
  { bg: "bg-[#FAEBDD]", text: "text-[#D9730D]" },
  { bg: "bg-[#F6F3F9]", text: "text-[#9065B0]" },
  { bg: "bg-[#E6F3F7]", text: "text-[#337EA9]" },
  { bg: "bg-[#F9F2F5]", text: "text-[#C14C8A]" },
  { bg: "bg-[#F4EEEE]", text: "text-[#9F6B53]" },
];

const scoreGradient = (score?: number) => {
  if (!score) return "from-[#787774] to-[#A8A8A8]";
  if (score >= 85) return "from-[#5B8A5E] to-[#7BA67D]";
  if (score >= 70) return "from-[#C9A24A] to-[#D4B15A]";
  return "from-[#C45A4A] to-[#D67A6A]";
};

export default function ProfilePage() {
  const { user, loading, logout, isVip } = useAuth();
  const router = useRouter();
  const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/advisor/history?page=${page}&limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          setAuditHistory(data.history);
          setTotalPages(data.pagination?.totalPages || 0);
          setTotal(data.pagination?.total || 0);
        }
      } catch (e) {
        console.error("History fetch error:", e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user, page, limit]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    let label = "";
    if (isToday) label = "今天";
    else if (isYesterday) label = "昨天";
    else label = date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });

    return {
      label,
      full: date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      weekday: date.toLocaleDateString("zh-CN", { weekday: "short" }),
    };
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3D4430]/40 animate-spin" />
      </div>
    );
  }

  const latestScore = auditHistory[0]?.analysisResult?.faceAnalysis?.overallScore;
  const avgScore =
    auditHistory.length > 0
      ? Math.round(
          auditHistory.reduce(
            (sum, s) => sum + (s.analysisResult?.faceAnalysis?.overallScore || 0),
            0
          ) / auditHistory.length
        )
      : null;

  const avatarUrl = user?.avatar;

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-[#F8F7F3]/80 backdrop-blur-md border-b border-[#3D4430]/6">
        <div className="max-w-6xl mx-auto h-16 md:h-20 flex items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="group flex items-center justify-center w-10 h-10 rounded-full border border-[#3D4430]/10 text-[#3D4430]/70 hover:text-[#3D4430] hover:border-[#3D4430]/25 hover:bg-[#3D4430]/5 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-medium tracking-[0.15em] text-[#3D4430]">NIHPLOD</span>
              <span className="text-[#3D4430]/30">/</span>
              <span className="text-[15px] tracking-[0.1em] text-[#3D4430]/70">测肤记录</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.15em] text-[#3D4430]/70 border border-[#3D4430]/10 rounded-full hover:text-[#3D4430] hover:border-[#3D4430]/25 hover:bg-[#3D4430]/5 transition-all duration-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
        {/* Hero */}
        <m.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 md:mb-16"
        >
          <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-[#3D4430]/8 ring-1 ring-[#3D4430]/10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl md:text-3xl font-serif text-[#3D4430]/60">
                  {(user.name?.[0] || "?").toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[13px] tracking-[0.2em] text-[#3D4430]/50 uppercase">Personal Center</span>
                {isVip && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] tracking-wider rounded-full bg-[#3D4430] text-[#F8F7F3] font-medium">
                    <Sparkles className="w-3 h-3" />
                    VIP
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl md:text-5xl text-[#3D4430] mb-2">
                你好，{user.name || "朋友"}
              </h1>
              <p className="text-[15px] text-[#5E5E5E] tracking-wide">
                以下是您的 AI 测肤历史记录与护肤档案
              </p>
            </div>

            <Link
              href="/questions"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#3D4430] text-[#F8F7F3] text-[13px] tracking-[0.15em] rounded-full hover:bg-[#3D4430]/90 transition-all duration-300 hover:shadow-lg hover:shadow-[#3D4430]/10 hover:-translate-y-0.5"
            >
              <ScanFace className="w-4 h-4" />
              再次测肤
            </Link>
          </div>
        </m.section>

        {/* Stats */}
        <m.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12 md:mb-16"
        >
          <div className="group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 p-6 transition-all duration-500 hover:bg-white/80 hover:shadow-xl hover:shadow-[#3D4430]/5 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#3D4430]/8 flex items-center justify-center text-[#3D4430]">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-[0.15em] text-[#5E5E5E]/70 uppercase">累计测肤</span>
            </div>
            <div className="font-serif text-4xl text-[#3D4430]">{auditHistory.length}</div>
            <p className="mt-1 text-[13px] text-[#5E5E5E]">次完整分析</p>
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 p-6 transition-all duration-500 hover:bg-white/80 hover:shadow-xl hover:shadow-[#3D4430]/5 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#C9A86C]/15 flex items-center justify-center text-[#8B7355]">
                <Award className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-[0.15em] text-[#5E5E5E]/70 uppercase">最近评分</span>
            </div>
            <div className="font-serif text-4xl text-[#3D4430]">
              {latestScore ?? "—"}
            </div>
            <p className="mt-1 text-[13px] text-[#5E5E5E]">
              {latestScore ? (latestScore >= 85 ? "肌肤状态优秀" : latestScore >= 70 ? "状态良好" : "建议关注") : "暂无记录"}
            </p>
          </div>

          <div className="group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 p-6 transition-all duration-500 hover:bg-white/80 hover:shadow-xl hover:shadow-[#3D4430]/5 hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#3D4430]/8 flex items-center justify-center text-[#3D4430]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-[0.15em] text-[#5E5E5E]/70 uppercase">平均评分</span>
            </div>
            <div className="font-serif text-4xl text-[#3D4430]">{avgScore ?? "—"}</div>
            <p className="mt-1 text-[13px] text-[#5E5E5E]">
              {avgScore ? "综合历史表现" : "暂无记录"}
            </p>
          </div>
        </m.section>

        {/* Section Title */}
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4 mb-6 md:mb-8"
        >
          <h2 className="font-serif text-2xl md:text-3xl text-[#3D4430]">测肤记录</h2>
          <div className="flex-1 h-px bg-[#3D4430]/10" />
          {total > 0 && (
            <span className="text-[13px] text-[#5E5E5E]">
              共 {total} 条
            </span>
          )}
        </m.div>

        {/* History List */}
        <div className="space-y-4">
          {loadingHistory ? (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-64 flex flex-col items-center justify-center gap-4 rounded-2xl bg-white/40 border border-[#3D4430]/8"
            >
              <Loader2 className="w-6 h-6 text-[#3D4430]/40 animate-spin" />
              <span className="text-[14px] tracking-wide text-[#5E5E5E]">加载记录中...</span>
            </m.div>
          ) : auditHistory.length === 0 ? (
            <m.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-center py-20 md:py-28 rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#3D4430]/8 flex items-center justify-center text-[#3D4430]/40">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-xl text-[#3D4430] mb-2">暂无测肤记录</h3>
              <p className="text-[14px] text-[#5E5E5E] mb-8 max-w-sm mx-auto">
                开始您的第一次 AI 皮肤分析，记录专属护肤历程
              </p>
              <Link
                href="/questions"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#3D4430] text-[#F8F7F3] text-[13px] tracking-[0.15em] rounded-full hover:bg-[#3D4430]/90 transition-all duration-300 hover:shadow-lg hover:shadow-[#3D4430]/10 hover:-translate-y-0.5"
              >
                <ScanFace className="w-4 h-4" />
                立即测肤
              </Link>
            </m.div>
          ) : (
            auditHistory.map((session, i) => {
              const result = session.analysisResult;
              const score = result?.faceAnalysis?.overallScore;
              const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
              const concerns = result?.skinProfile?.concerns || result?.concerns || [];
              const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
              const dateInfo = formatDate(session.completedAt);

              return (
                <m.div
                  key={session.sessionId}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={`/result?id=${session.sessionId}`}
                    className="group block rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 p-5 md:p-6 transition-all duration-500 hover:bg-white/90 hover:shadow-xl hover:shadow-[#3D4430]/5 hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-4 md:gap-6">
                      {/* Date */}
                      <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-[#F5F2ED] border border-[#3D4430]/6 shrink-0">
                        <span className="text-[11px] text-[#5E5E5E] tracking-wider">{dateInfo.label}</span>
                        <span className="text-[11px] text-[#5E5E5E]/70">{dateInfo.weekday}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="sm:hidden text-[12px] text-[#5E5E5E]/70">
                            {dateInfo.full}
                          </span>
                          <span className="hidden sm:inline text-[12px] text-[#5E5E5E]/70">
                            {dateInfo.full}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            {skinType ? (
                              <h3 className="font-serif text-lg md:text-xl text-[#3D4430] mb-2 truncate">
                                {skinType}
                              </h3>
                            ) : (
                              <h3 className="font-serif text-lg md:text-xl text-[#3D4430] mb-2">
                                皮肤分析报告
                              </h3>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              {skinType && (
                                <span className="px-2.5 py-1 text-[12px] rounded-full bg-[#E6F3F7] text-[#337EA9] font-medium">
                                  {skinType}
                                </span>
                              )}
                              {skinAge && (
                                <span className="px-2.5 py-1 text-[12px] rounded-full bg-[#F1F1EF] text-[#787774] font-medium">
                                  肤龄 {skinAge}
                                </span>
                              )}
                              {concerns.slice(0, 3).map((c, idx) => {
                                const palette = concernPalette[idx % concernPalette.length];
                                return (
                                  <span
                                    key={idx}
                                    className={`px-2.5 py-1 text-[12px] rounded-full font-medium ${palette.bg} ${palette.text}`}
                                  >
                                    {c}
                                  </span>
                                );
                              })}
                              {concerns.length > 3 && (
                                <span className="text-[12px] text-[#5E5E5E]/70">
                                  +{concerns.length - 3}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Score */}
                          {score && (
                            <div className="shrink-0 flex flex-col items-end">
                              <div
                                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-gradient-to-br ${scoreGradient(score)} text-white shadow-lg`}
                              >
                                <span className="text-base md:text-lg font-semibold">{score}</span>
                              </div>
                              <span className="mt-1.5 text-[11px] tracking-wider text-[#5E5E5E]/70">综合评分</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="hidden md:flex shrink-0 self-center">
                        <ChevronRight className="w-5 h-5 text-[#3D4430]/20 transition-all duration-300 group-hover:text-[#3D4430]/50 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </m.div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-between mt-10 pt-6 border-t border-[#3D4430]/10"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loadingHistory}
              className="flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.1em] text-[#3D4430]/70 border border-[#3D4430]/10 rounded-full hover:text-[#3D4430] hover:border-[#3D4430]/25 hover:bg-[#3D4430]/5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>

            <span className="text-[13px] text-[#5E5E5E]">
              第 {page} / {totalPages} 页
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loadingHistory}
              className="flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.1em] text-[#3D4430]/70 border border-[#3D4430]/10 rounded-full hover:text-[#3D4430] hover:border-[#3D4430]/25 hover:bg-[#3D4430]/5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </m.div>
        )}

        {/* Footer hint */}
        <div className="mt-16 pt-8 border-t border-[#3D4430]/10 text-center">
          <p className="text-[12px] tracking-[0.1em] text-[#5E5E5E]/60">
            点击记录可查看完整 AI 护肤报告
          </p>
        </div>
      </main>
    </div>
  );
}
