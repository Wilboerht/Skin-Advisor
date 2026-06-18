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
  Calendar,
  Camera,
  Pencil,
  Check,
  X,
  ExternalLink,
  Smartphone
} from "lucide-react";
import { LazyMotion, domAnimation, m } from "framer-motion";
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
  { bg: "bg-stone-100", text: "text-stone-600" },
  { bg: "bg-stone-100", text: "text-stone-600" },
  { bg: "bg-stone-100", text: "text-stone-600" },
  { bg: "bg-stone-100", text: "text-stone-600" },
  { bg: "bg-stone-100", text: "text-stone-600" },
];

const scoreGradient = (score?: number) => {
  if (!score) return "from-neutral-400 to-neutral-500";
  if (score >= 85) return "from-emerald-500 to-emerald-600";
  if (score >= 70) return "from-amber-500 to-amber-600";
  return "from-rose-500 to-rose-600";
};

interface BrandActivity {
  id: string;
  title: string;
  description: string;
  link: string;
  external: boolean;
}

const BRAND_ACTIVITIES: BrandActivity[] = [
  {
    id: "vip",
    title: "会员专属礼遇",
    description: "解锁专属护肤方案、优先体验新品与限量会员活动",
    link: "https://nihplod.cn",
    external: true,
  },
  {
    id: "skin-test",
    title: "AI 素颜测肤",
    description: "获取专业级肌肤分析与定制化护肤建议",
    link: "/questions",
    external: false,
  },
];

export default function ProfilePage() {
  const { user, loading, logout, isVip, refresh } = useAuth();
  const router = useRouter();
  const [auditHistory, setAuditHistory] = useState<HistorySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  const maskPhone = (phone?: string | null) => {
    if (!phone) return "—";
    if (phone.length <= 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUpdatingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || "上传失败");

      const updateRes = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: uploadData.url }),
      });
      if (!updateRes.ok) throw new Error("保存失败");
      await refresh();
    } catch (err) {
      console.error("Avatar update error:", err);
      alert(err instanceof Error ? err.message : "头像更新失败");
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = editedName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("保存失败");
      await refresh();
      setIsEditingName(false);
    } catch (err) {
      console.error("Name update error:", err);
      alert("昵称更新失败");
    }
  };

  const startEditName = () => {
    setEditedName(user?.name || "");
    setIsEditingName(true);
  };

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
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
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-white text-neutral-900">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-neutral-100">
          <div className="max-w-3xl mx-auto h-16 md:h-20 flex items-center justify-between px-6 md:px-10">
            <Link
              href="/"
              className="flex items-center gap-3 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-[15px] font-medium tracking-[0.05em]">个人中心</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-[13px] tracking-[0.05em] text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出登录</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-3xl mx-auto px-6 md:px-10 py-10 md:py-16">
          {/* Profile */}
          <m.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 md:mb-16"
          >
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <label className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-neutral-100 cursor-pointer group mb-5">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl md:text-3xl font-medium text-neutral-500">
                    {(user.name?.[0] || "?").toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all duration-300">
                  {updatingAvatar ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin opacity-0 group-hover:opacity-100" />
                  ) : (
                    <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  disabled={updatingAvatar}
                  className="sr-only"
                />
              </label>

              {/* Name */}
              <div className="mb-3">
                {isEditingName ? (
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setIsEditingName(false);
                      }}
                      maxLength={20}
                      autoFocus
                      className="px-3 py-1.5 text-xl md:text-2xl font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 text-center"
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                      aria-label="保存昵称"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                      aria-label="取消"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
                      {user.name || "朋友"}
                    </h1>
                    <button
                      onClick={startEditName}
                      className="p-1.5 rounded-full text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                      aria-label="编辑昵称"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[14px] text-neutral-500 mb-6">
                {isVip && (
                  <span className="inline-flex items-center gap-1 text-neutral-900">
                    <Sparkles className="w-3.5 h-3.5" />
                    VIP 会员
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{maskPhone(user.phone)}</span>
                </div>
              </div>

              {/* CTA */}
              <Link
                href="/questions"
                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-full text-[13px] tracking-[0.05em] font-medium text-neutral-700 border border-neutral-200 hover:border-neutral-400 hover:text-neutral-900 transition-all duration-300"
              >
                <ScanFace className="w-4 h-4" />
                再次测肤
              </Link>
            </div>
          </m.section>

          {/* Stats */}
          <m.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 md:mb-16"
          >
            <div className="grid grid-cols-3 gap-6 md:gap-10 py-6 border-y border-neutral-100">
              <div className="text-center">
                <div className="text-[11px] tracking-[0.1em] uppercase text-neutral-400 mb-1.5">累计测肤</div>
                <div className="text-2xl md:text-3xl font-semibold text-neutral-900">{auditHistory.length}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">次</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] tracking-[0.1em] uppercase text-neutral-400 mb-1.5">最近评分</div>
                <div className="text-2xl md:text-3xl font-semibold text-neutral-900">{latestScore ?? "—"}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{latestScore ? "分" : "暂无"}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] tracking-[0.1em] uppercase text-neutral-400 mb-1.5">平均评分</div>
                <div className="text-2xl md:text-3xl font-semibold text-neutral-900">{avgScore ?? "—"}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{avgScore ? "分" : "暂无"}</div>
              </div>
            </div>
          </m.section>

          {/* History */}
          <m.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-12 md:mb-16"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base md:text-lg font-semibold text-neutral-900">测肤记录</h2>
              {total > 0 && (
                <span className="text-[12px] text-neutral-400">共 {total} 条</span>
              )}
            </div>

            <div className="border border-neutral-100 rounded-2xl overflow-hidden">
              {loadingHistory ? (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-48 flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
                  <span className="text-[13px] text-neutral-400">加载记录中...</span>
                </m.div>
              ) : auditHistory.length === 0 ? (
                <m.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                  className="text-center py-14 md:py-20"
                >
                  <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-300">
                    <Clock className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[15px] font-medium text-neutral-900 mb-1.5">暂无测肤记录</h3>
                  <p className="text-[13px] text-neutral-400 mb-5">开始第一次 AI 皮肤分析</p>
                  <Link
                    href="/questions"
                    className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] tracking-[0.05em] font-medium text-neutral-700 border border-neutral-200 hover:border-neutral-400 hover:text-neutral-900 transition-all duration-300"
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    立即测肤
                  </Link>
                </m.div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="text-left py-3 px-4 md:px-5 font-medium text-[11px] text-neutral-400 uppercase tracking-wider">时间</th>
                        <th className="text-left py-3 px-4 md:px-5 font-medium text-[11px] text-neutral-400 uppercase tracking-wider">肤质</th>
                        <th className="text-left py-3 px-4 md:px-5 font-medium text-[11px] text-neutral-400 uppercase tracking-wider">问题</th>
                        <th className="text-right py-3 px-4 md:px-5 font-medium text-[11px] text-neutral-400 uppercase tracking-wider">评分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditHistory.map((session) => {
                        const result = session.analysisResult;
                        const score = result?.faceAnalysis?.overallScore;
                        const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                        const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                        const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                        const dateInfo = formatDate(session.completedAt);

                        return (
                          <tr
                            key={session.sessionId}
                            className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/50 transition-colors"
                          >
                            <td className="py-3.5 px-4 md:px-5">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                <div className="text-[13px] text-neutral-900">{dateInfo.full.split(" ")[0]}</div>
                                <div className="text-[11px] text-neutral-400">{dateInfo.full.split(" ")[1]}</div>
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 md:px-5">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                {skinType ? (
                                  <span className="text-[12px] text-neutral-600">{skinType}</span>
                                ) : (
                                  <span className="text-[12px] text-neutral-300">—</span>
                                )}
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 md:px-5">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {concerns.slice(0, 2).map((c, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 text-[10px] rounded-full bg-neutral-100 text-neutral-600"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                  {concerns.length === 0 && (
                                    <span className="text-[11px] text-neutral-300">—</span>
                                  )}
                                  {concerns.length > 2 && (
                                    <span className="text-[10px] text-neutral-400">+{concerns.length - 2}</span>
                                  )}
                                  {skinAge && (
                                    <span className="text-[10px] text-neutral-400">肤龄 {skinAge}</span>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 md:px-5 text-right">
                              <Link href={`/result?id=${session.sessionId}`} className="inline-flex items-center justify-end gap-2">
                                {score ? (
                                  <>
                                    <span className="text-[13px] font-medium text-neutral-900">{score}</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
                                  </>
                                ) : (
                                  <span className="text-[12px] text-neutral-300">—</span>
                                )}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between mt-6"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingHistory}
                  className="flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>

                <span className="text-[12px] text-neutral-400">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingHistory}
                  className="flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </m.div>
            )}
          </m.section>

          {/* Brand Activities */}
          <m.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-base md:text-lg font-semibold text-neutral-900 mb-5">品牌活动</h2>

            <div className="space-y-3">
              {BRAND_ACTIVITIES.map((activity) => {
                const CardWrapper = activity.external ? "a" : Link;
                return (
                  <CardWrapper
                    key={activity.id}
                    href={activity.link}
                    target={activity.external ? "_blank" : undefined}
                    rel={activity.external ? "noopener noreferrer" : undefined}
                    className="group flex items-center justify-between py-4 px-5 border border-neutral-100 rounded-2xl hover:border-neutral-200 hover:bg-neutral-50/30 transition-all duration-300"
                  >
                    <div>
                      <h3 className="text-[14px] font-medium text-neutral-900 mb-0.5 group-hover:text-neutral-700 transition-colors">
                        {activity.title}
                      </h3>
                      <p className="text-[12px] text-neutral-400">{activity.description}</p>
                    </div>
                    <div className="shrink-0 text-neutral-300 group-hover:text-neutral-500 transition-colors ml-4">
                      {activity.external ? (
                        <ExternalLink className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </CardWrapper>
                );
              })}
            </div>
          </m.section>
        </main>
      </div>
    </LazyMotion>
  );
}
