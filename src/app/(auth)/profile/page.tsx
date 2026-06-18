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
  Smartphone,
  User
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1B3A5C]/40 animate-spin" />
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
      <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A]">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D9]">
          <div className="max-w-5xl mx-auto h-16 md:h-20 flex items-center justify-between px-6 md:px-10">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="group flex items-center justify-center w-10 h-10 rounded-full border border-[#E8E2D9] text-[#4A4A4A] hover:text-[#1A1A1A] hover:border-[#1B3A5C]/30 hover:bg-white transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
              </Link>
              <span className="text-[15px] font-medium tracking-[0.1em] text-[#1A1A1A]">个人中心</span>
            </div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.1em] text-[#4A4A4A] border border-[#E8E2D9] rounded-full hover:text-[#1A1A1A] hover:border-[#1B3A5C]/30 hover:bg-white transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出登录</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-6 md:px-10 py-8 md:py-14">
          {/* Profile Card */}
          <m.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[#E8E2D9]">
              <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
                {/* Avatar */}
                <label className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-[#F5F2ED] ring-2 ring-[#E8E2D9] cursor-pointer group shrink-0 mx-auto md:mx-0">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-medium text-[#1B3A5C]">
                      {(user.name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-all duration-300">
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

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-3">
                    {isEditingName ? (
                      <div className="flex items-center justify-center md:justify-start gap-2">
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
                          className="px-3 py-1.5 text-xl md:text-2xl font-semibold text-[#1A1A1A] bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#1B3A5C]/40"
                        />
                        <button
                          onClick={handleSaveName}
                          className="p-1.5 rounded-full text-[#4A4A4A] hover:text-[#1B3A5C] hover:bg-[#1B3A5C]/8 transition-colors"
                          aria-label="保存昵称"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="p-1.5 rounded-full text-[#4A4A4A] hover:text-[#1A1A1A] hover:bg-[#1B3A5C]/8 transition-colors"
                          aria-label="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h1 className="text-2xl md:text-3xl font-semibold text-[#1A1A1A]">
                          {user.name || "朋友"}
                        </h1>
                        <button
                          onClick={startEditName}
                          className="p-1.5 rounded-full text-[#4A4A4A]/60 hover:text-[#1B3A5C] hover:bg-[#1B3A5C]/8 transition-colors"
                          aria-label="编辑昵称"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {isVip && (
                      <span className="inline-flex items-center justify-center gap-1 px-3 py-1 text-[11px] tracking-wider rounded-full bg-[#1B3A5C] text-white font-medium w-fit mx-auto md:mx-0">
                        <Sparkles className="w-3 h-3" />
                        VIP 会员
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-5 text-[14px] text-[#4A4A4A] font-light">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#4A4A4A]/60" />
                      <span>{maskPhone(user.phone)}</span>
                    </div>
                    <span className="hidden sm:inline text-[#E8E2D9]">|</span>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#4A4A4A]/60" />
                      <span>AI 护肤顾问用户</span>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href="/questions"
                  className="inline-flex items-center justify-center gap-2 h-[42px] px-6 rounded-full shrink-0 text-[12px] tracking-[0.1em] font-medium text-[#1B3A5C] border border-[#1B3A5C]/20 bg-white hover:bg-[#1B3A5C] hover:text-white hover:border-[#1B3A5C] transition-all duration-300 mx-auto md:mx-0"
                >
                  <ScanFace className="w-4 h-4" />
                  再次测肤
                </Link>
              </div>
            </div>
          </m.section>

          {/* Stats */}
          <m.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10"
          >
            {[
              {
                icon: Calendar,
                label: "累计测肤",
                value: auditHistory.length,
                unit: "次",
                desc: "完整分析",
              },
              {
                icon: Award,
                label: "最近评分",
                value: latestScore ?? "—",
                unit: latestScore ? "分" : "",
                desc: latestScore ? (latestScore >= 85 ? "状态优秀" : latestScore >= 70 ? "状态良好" : "建议关注") : "暂无记录",
              },
              {
                icon: TrendingUp,
                label: "平均评分",
                value: avgScore ?? "—",
                unit: avgScore ? "分" : "",
                desc: avgScore ? "综合历史" : "暂无记录",
              },
            ].map((stat, idx) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-[#E8E2D9] hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1B3A5C] text-white text-sm font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-[13px] tracking-[0.1em] text-[#4A4A4A]/70 uppercase">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl md:text-4xl font-semibold text-[#1A1A1A]">{stat.value}</span>
                  {stat.unit && <span className="text-[13px] text-[#4A4A4A]/70">{stat.unit}</span>}
                </div>
                <p className="text-[13px] text-[#4A4A4A] font-light">{stat.desc}</p>
              </div>
            ))}
          </m.section>

          {/* History */}
          <m.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10"
          >
            <div className="flex items-center gap-4 mb-5 md:mb-6">
              <h2 className="text-xl md:text-2xl font-semibold text-[#1A1A1A]">测肤记录</h2>
              <div className="flex-1 h-px bg-[#E8E2D9]" />
              {total > 0 && (
                <span className="text-[13px] text-[#4A4A4A]">共 {total} 条</span>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2D9] overflow-hidden">
              {loadingHistory ? (
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-56 flex flex-col items-center justify-center gap-4"
                >
                  <Loader2 className="w-6 h-6 text-[#1B3A5C]/40 animate-spin" />
                  <span className="text-[14px] tracking-wide text-[#4A4A4A]">加载记录中...</span>
                </m.div>
              ) : auditHistory.length === 0 ? (
                <m.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="text-center py-16 md:py-24"
                >
                  <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D9] flex items-center justify-center text-[#4A4A4A]/60">
                    <Clock className="w-7 h-7" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">暂无测肤记录</h3>
                  <p className="text-[14px] text-[#4A4A4A] font-light mb-6 max-w-sm mx-auto leading-[1.85]">
                    开始您的第一次 AI 皮肤分析，记录专属护肤历程
                  </p>
                  <Link
                    href="/questions"
                    className="inline-flex items-center gap-2 h-[42px] px-7 rounded-full text-[12px] tracking-[0.1em] font-medium text-[#1B3A5C] border border-[#1B3A5C]/20 bg-white hover:bg-[#1B3A5C] hover:text-white hover:border-[#1B3A5C] transition-all duration-300"
                  >
                    <ScanFace className="w-4 h-4" />
                    立即测肤
                  </Link>
                </m.div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#D9D0C3]">
                        <th className="text-left py-3 px-4 md:px-6 font-semibold text-[#1B3A5C] uppercase tracking-wider text-[11px] md:text-xs">测肤时间</th>
                        <th className="text-left py-3 px-4 md:px-6 font-semibold text-[#1B3A5C] uppercase tracking-wider text-[11px] md:text-xs">肤质类型</th>
                        <th className="text-left py-3 px-4 md:px-6 font-semibold text-[#1B3A5C] uppercase tracking-wider text-[11px] md:text-xs">主要问题</th>
                        <th className="text-right py-3 px-4 md:px-6 font-semibold text-[#1B3A5C] uppercase tracking-wider text-[11px] md:text-xs">综合评分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditHistory.map((session, i) => {
                        const result = session.analysisResult;
                        const score = result?.faceAnalysis?.overallScore;
                        const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                        const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                        const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                        const dateInfo = formatDate(session.completedAt);

                        return (
                          <tr
                            key={session.sessionId}
                            className="border-b border-[#E8E2D9] last:border-0 hover:bg-[#FAF8F5]/60 transition-colors"
                          >
                            <td className="py-4 px-4 md:px-6">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
                                  <span className="text-[14px] text-[#1A1A1A] font-medium">{dateInfo.full.split(" ")[0]}</span>
                                  <span className="text-[12px] text-[#4A4A4A]/70">{dateInfo.full.split(" ")[1]}</span>
                                </div>
                              </Link>
                            </td>
                            <td className="py-4 px-4 md:px-6">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                {skinType ? (
                                  <span className="inline-flex px-2.5 py-1 text-[11px] md:text-[12px] rounded-full bg-[#E6F3F7] text-[#337EA9] font-medium">
                                    {skinType}
                                  </span>
                                ) : (
                                  <span className="text-[13px] text-[#4A4A4A] font-light">—</span>
                                )}
                              </Link>
                            </td>
                            <td className="py-4 px-4 md:px-6">
                              <Link href={`/result?id=${session.sessionId}`} className="block">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {concerns.slice(0, 3).map((c, idx) => {
                                    const palette = concernPalette[idx % concernPalette.length];
                                    return (
                                      <span
                                        key={idx}
                                        className={`px-2 py-0.5 text-[10px] md:text-[11px] rounded-full font-medium ${palette.bg} ${palette.text}`}
                                      >
                                        {c}
                                      </span>
                                    );
                                  })}
                                  {concerns.length === 0 && (
                                    <span className="text-[12px] text-[#4A4A4A]/70 font-light">暂无问题标签</span>
                                  )}
                                  {concerns.length > 3 && (
                                    <span className="text-[11px] text-[#4A4A4A]/60">+{concerns.length - 3}</span>
                                  )}
                                  {skinAge && (
                                    <span className="ml-1 text-[11px] text-[#4A4A4A]/60">肤龄 {skinAge}</span>
                                  )}
                                </div>
                              </Link>
                            </td>
                            <td className="py-4 px-4 md:px-6 text-right">
                              <Link href={`/result?id=${session.sessionId}`} className="inline-flex items-center justify-end gap-2">
                                {score ? (
                                  <>
                                    <div
                                      className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${scoreGradient(score)} text-white text-[11px] md:text-[12px] font-semibold`}
                                    >
                                      {score}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-[#4A4A4A]/30" />
                                  </>
                                ) : (
                                  <span className="text-[13px] text-[#4A4A4A] font-light">—</span>
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
                className="flex items-center justify-between mt-8 pt-5 border-t border-[#E8E2D9]"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingHistory}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.1em] text-[#4A4A4A] border border-[#E8E2D9] rounded-full hover:text-[#1A1A1A] hover:border-[#1B3A5C]/30 hover:bg-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </button>

                <span className="text-[13px] text-[#4A4A4A]">
                  第 {page} / {totalPages} 页
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingHistory}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] tracking-[0.1em] text-[#4A4A4A] border border-[#E8E2D9] rounded-full hover:text-[#1A1A1A] hover:border-[#1B3A5C]/30 hover:bg-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </button>
              </m.div>
            )}
          </m.section>

          {/* Brand Activities */}
          <m.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-4 mb-5 md:mb-6">
              <h2 className="text-xl md:text-2xl font-semibold text-[#1A1A1A]">品牌活动</h2>
              <div className="flex-1 h-px bg-[#E8E2D9]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {BRAND_ACTIVITIES.map((activity, idx) => {
                const CardWrapper = activity.external ? "a" : Link;
                return (
                  <CardWrapper
                    key={activity.id}
                    href={activity.link}
                    target={activity.external ? "_blank" : undefined}
                    rel={activity.external ? "noopener noreferrer" : undefined}
                    className="group flex items-start gap-4 bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-[#E8E2D9] hover:shadow-md transition-shadow"
                  >
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1B3A5C] text-white text-sm font-medium shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold text-[#1A1A1A] mb-1.5 group-hover:text-[#1B3A5C] transition-colors">
                        {activity.title}
                      </h3>
                      <p className="text-[13px] md:text-[14px] text-[#4A4A4A] font-light leading-[1.75]">
                        {activity.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-[#4A4A4A]/40 group-hover:text-[#1B3A5C] transition-colors">
                      {activity.external ? (
                        <ExternalLink className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </CardWrapper>
                );
              })}
            </div>
          </m.section>

          {/* Footer */}
          <div className="mt-12 md:mt-16 pt-6 border-t border-[#E8E2D9] text-center">
            <p className="text-[12px] tracking-[0.1em] text-[#4A4A4A]/50">
              点击记录可查看完整 AI 护肤报告
            </p>
          </div>
        </main>
      </div>
    </LazyMotion>
  );
}
