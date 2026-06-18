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
  ExternalLink
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

interface BrandActivity {
  id: string;
  title: string;
  description: string;
  link: string;
  external: boolean;
}

// 品牌活动配置：后续可扩展为 CMS/API 读取
const BRAND_ACTIVITIES: BrandActivity[] = [
  {
    id: "vip",
    title: "会员专属礼遇",
    description: "加入 NIHPLOD 会员，解锁专属护肤方案、优先体验新品与限量会员活动。",
    link: "https://nihplod.cn",
    external: true,
  },
  {
    id: "skin-test",
    title: "AI 素颜测肤",
    description: "随时随地获取专业级肌肤分析，生成你的专属定制化护肤建议。",
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
    <LazyMotion features={domAnimation}>
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
            {/* Avatar with upload */}
            <label className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-[#3D4430]/8 ring-1 ring-[#3D4430]/10 cursor-pointer group shrink-0">
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300">
                {updatingAvatar ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin opacity-0 group-hover:opacity-100" />
                ) : (
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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

              {/* Editable name */}
              <div className="flex items-center gap-3 mb-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
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
                      className="px-3 py-1.5 text-2xl md:text-4xl font-serif text-[#3D4430] bg-white/70 border border-[#3D4430]/15 rounded-lg focus:outline-none focus:border-[#3D4430]/40"
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-2 rounded-full text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/10 transition-colors"
                      aria-label="保存昵称"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-2 rounded-full text-[#3D4430]/70 hover:text-[#3D4430] hover:bg-[#3D4430]/10 transition-colors"
                      aria-label="取消"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="font-serif text-3xl md:text-5xl text-[#3D4430]">
                      你好，{user.name || "朋友"}
                    </h1>
                    <button
                      onClick={startEditName}
                      className="p-2 rounded-full text-[#3D4430]/40 hover:text-[#3D4430] hover:bg-[#3D4430]/10 transition-colors"
                      aria-label="编辑昵称"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-[#5E5E5E] tracking-wide">
                <span>手机号：{maskPhone(user.phone)}</span>
                <span className="hidden sm:inline text-[#3D4430]/20">|</span>
                <span>以下是您的 AI 测肤历史记录与护肤档案</span>
              </div>
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
        <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 overflow-hidden">
          {loadingHistory ? (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-64 flex flex-col items-center justify-center gap-4"
            >
              <Loader2 className="w-6 h-6 text-[#3D4430]/40 animate-spin" />
              <span className="text-[14px] tracking-wide text-[#5E5E5E]">加载记录中...</span>
            </m.div>
          ) : auditHistory.length === 0 ? (
            <m.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-center py-20 md:py-28"
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
            <>
              {/* List Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-[#F5F2ED]/70 border-b border-[#3D4430]/8 text-[12px] tracking-[0.1em] text-[#5E5E5E]/70 uppercase">
                <div className="col-span-3">测肤时间</div>
                <div className="col-span-2">肤质类型</div>
                <div className="col-span-4">主要问题</div>
                <div className="col-span-2 text-right">综合评分</div>
                <div className="col-span-1" />
              </div>

              {/* List Items */}
              {auditHistory.map((session, i) => {
                const result = session.analysisResult;
                const score = result?.faceAnalysis?.overallScore;
                const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                const dateInfo = formatDate(session.completedAt);

                return (
                  <m.div
                    key={session.sessionId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className={`group ${i !== auditHistory.length - 1 ? "border-b border-[#3D4430]/6" : ""}`}
                  >
                    <Link
                      href={`/result?id=${session.sessionId}`}
                      className="block px-5 py-4 md:px-6 md:py-4 transition-all duration-300 hover:bg-[#F5F2ED]/50"
                    >
                      <div className="grid grid-cols-12 gap-3 md:gap-4 items-center">
                        {/* Time */}
                        <div className="col-span-12 md:col-span-3">
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] md:text-[14px] text-[#3D4430] font-medium">
                              {dateInfo.full.split(" ")[0]}
                            </span>
                            <span className="text-[12px] md:text-[13px] text-[#5E5E5E]/70">
                              {dateInfo.full.split(" ")[1]}
                            </span>
                          </div>
                        </div>

                        {/* Skin Type */}
                        <div className="col-span-6 md:col-span-2">
                          {skinType ? (
                            <span className="inline-flex px-2.5 py-1 text-[12px] rounded-full bg-[#E6F3F7] text-[#337EA9] font-medium">
                              {skinType}
                            </span>
                          ) : (
                            <span className="text-[13px] text-[#5E5E5E]/60">—</span>
                          )}
                        </div>

                        {/* Concerns */}
                        <div className="col-span-12 md:col-span-4 order-last md:order-none mt-1 md:mt-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {concerns.slice(0, 3).map((c, idx) => {
                              const palette = concernPalette[idx % concernPalette.length];
                              return (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${palette.bg} ${palette.text}`}
                                >
                                  {c}
                                </span>
                              );
                            })}
                            {concerns.length === 0 && (
                              <span className="text-[12px] text-[#5E5E5E]/50">暂无问题标签</span>
                            )}
                            {concerns.length > 3 && (
                              <span className="text-[11px] text-[#5E5E5E]/60">
                                +{concerns.length - 3}
                              </span>
                            )}
                            {skinAge && (
                              <span className="ml-1 text-[11px] text-[#5E5E5E]/60">
                                肤龄 {skinAge}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="col-span-6 md:col-span-2 text-right">
                          {score ? (
                            <div className="inline-flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${scoreGradient(score)} text-white text-[12px] font-semibold`}
                              >
                                {score}
                              </div>
                              <span className="hidden md:inline text-[12px] text-[#5E5E5E]/70">综合评分</span>
                            </div>
                          ) : (
                            <span className="text-[13px] text-[#5E5E5E]/60">—</span>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="hidden md:col-span-1 md:flex justify-end">
                          <ChevronRight className="w-4 h-4 text-[#3D4430]/20 transition-all duration-300 group-hover:text-[#3D4430]/50 group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Link>
                  </m.div>
                );
              })}
            </>
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

        {/* Brand Activities */}
        <m.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 md:mt-20"
        >
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <h2 className="font-serif text-2xl md:text-3xl text-[#3D4430]">品牌活动</h2>
            <div className="flex-1 h-px bg-[#3D4430]/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {BRAND_ACTIVITIES.map((activity) => {
              const CardWrapper = activity.external ? "a" : Link;
              return (
                <CardWrapper
                  key={activity.id}
                  href={activity.link}
                  target={activity.external ? "_blank" : undefined}
                  rel={activity.external ? "noopener noreferrer" : undefined}
                  className="group relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-sm border border-[#3D4430]/8 p-6 transition-all duration-500 hover:bg-white/80 hover:shadow-xl hover:shadow-[#3D4430]/5 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-lg md:text-xl text-[#3D4430] mb-2">
                        {activity.title}
                      </h3>
                      <p className="text-[13px] md:text-[14px] text-[#5E5E5E] leading-relaxed">
                        {activity.description}
                      </p>
                    </div>
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#3D4430]/8 flex items-center justify-center text-[#3D4430]/70 group-hover:bg-[#3D4430] group-hover:text-[#F8F7F3] transition-all duration-300">
                      {activity.external ? (
                        <ExternalLink className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </CardWrapper>
              );
            })}
          </div>
        </m.section>

        {/* Footer hint */}
        <div className="mt-16 pt-8 border-t border-[#3D4430]/10 text-center">
          <p className="text-[12px] tracking-[0.1em] text-[#5E5E5E]/60">
            点击记录可查看完整 AI 护肤报告
          </p>
        </div>
      </main>
    </div>
    </LazyMotion>
  );
}
