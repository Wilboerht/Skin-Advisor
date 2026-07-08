"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "next-view-transitions";
import {
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ScanFace,
  LogOut,
  Smartphone,
  Camera,
  Pencil,
  Check,
  X,
  Calendar,
  Award,
} from "lucide-react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import Image from "next/image";
import { WebsiteNavbar } from "@/components/website/WebsiteNavbar";
import { getCharacterImage, getSkinTypeName } from "@/lib/result-utils";

interface AnalysisResult {
  faceAnalysis?: { overallScore?: number; skinAge?: number };
  skinProfile?: { type?: string; typeLabel?: string; concerns?: string[]; skinAge?: number };
  skinType?: { typeLabel?: string };
  concerns?: string[];
}

interface HistorySession {
  sessionId: string;
  completedAt: string;
  analysisResult?: AnalysisResult;
}

export default function ProfilePage() {
  const { user, loading, logout, refresh } = useAuth();
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
      router.push("/?auth=login");
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
    return {
      full: date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      short: date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
      relative: date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }),
    };
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A86C] animate-spin" />
      </div>
    );
  }

  const latestResult = auditHistory[0]?.analysisResult;
  const avgScore =
    auditHistory.length > 0
      ? Math.round(
          auditHistory.reduce(
            (sum, s) => sum + (s.analysisResult?.faceAnalysis?.overallScore || 0),
            0
          ) / auditHistory.length
        )
      : null;

  const latestSkinTypeCode = latestResult?.skinProfile?.type;
  const latestScore = latestResult?.faceAnalysis?.overallScore ?? 0;
  const latestSkinTypeName = latestScore > 0 && latestSkinTypeCode
    ? getSkinTypeName({ score: latestScore, skinType: latestSkinTypeCode })
    : null;
  const latestCharacterImage = latestScore > 0 && latestSkinTypeCode
    ? getCharacterImage({ score: latestScore, skinType: latestSkinTypeCode, gender: "female" })
    : null;

  const avatarUrl = user?.avatar;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#F8F7F3] text-[#1A1A1A]">
        <WebsiteNavbar />

        <main className="pt-20 md:pt-24 pb-20 md:pb-28">
          <div className="max-w-2xl mx-auto">
            {/* Cover */}
            <div className="relative h-40 md:h-52 bg-gradient-to-br from-[#E8E4D9] via-[#F0EDE3] to-[#E8E4D9]" />

            {/* Avatar + basic info */}
            <div className="relative px-6 md:px-8 pb-5">
              <div className="flex justify-between items-end -mt-16 md:-mt-20 mb-4">
                <label className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-[#ECEBE6] border-4 border-[#F8F7F3] cursor-pointer group shadow-lg">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl md:text-5xl font-medium text-[#8A8A8A]">
                      {(user.name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all duration-300">
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

                <div className="relative w-28 h-36 md:w-36 md:h-44 mb-2">
                  {latestCharacterImage ? (
                    <Image
                      src={latestCharacterImage}
                      alt={latestSkinTypeName || "肌肤形象"}
                      fill
                      className="object-contain object-bottom"
                      sizes="(max-width: 768px) 112px, 144px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-end justify-center pb-2 text-[#C9A86C]/40">
                      <ScanFace className="w-12 h-12" strokeWidth={1} />
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="mb-3">
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
                      className="px-3 py-1.5 text-xl md:text-2xl font-semibold text-[#1A1A1A] bg-white border border-[rgba(61,68,48,0.12)] rounded-lg focus:outline-none focus:border-[#3D4430]"
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1.5 rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-[rgba(61,68,48,0.06)] transition-colors"
                      aria-label="保存昵称"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-[rgba(61,68,48,0.06)] transition-colors"
                      aria-label="取消"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-semibold text-[#1A1A1A]">
                      {user.name || "朋友"}
                    </h1>
                    <button
                      onClick={startEditName}
                      className="p-1.5 rounded-full text-[#8A8A8A] hover:text-[#3D4430] hover:bg-[rgba(61,68,48,0.06)] transition-colors"
                      aria-label="编辑昵称"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#5E5E5E] mb-4">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{maskPhone(user.phone)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#8A8A8A]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>加入于 {new Date().getFullYear()}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 text-[14px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1A1A1A]">{auditHistory.length}</span>
                  <span className="text-[#5E5E5E]">次测肤</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1A1A1A]">{latestScore ?? "—"}</span>
                  <span className="text-[#5E5E5E]">最近评分</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1A1A1A]">{avgScore ?? "—"}</span>
                  <span className="text-[#5E5E5E]">平均评分</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-b border-[rgba(61,68,48,0.08)]" />

            {/* History */}
            <m.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 md:px-8 py-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base md:text-lg font-semibold text-[#1A1A1A]">测肤记录</h2>
                {total > 0 && <span className="text-[12px] text-[#8A8A8A]">共 {total} 条</span>}
              </div>

              {loadingHistory ? (
                <div className="h-48 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-5 h-5 text-[#C9A86C] animate-spin" />
                  <span className="text-[13px] text-[#8A8A8A]">加载记录中...</span>
                </div>
              ) : auditHistory.length === 0 ? (
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
                  {auditHistory.map((session) => {
                    const result = session.analysisResult;
                    const score = result?.faceAnalysis?.overallScore;
                    const skinType = result?.skinProfile?.typeLabel || result?.skinType?.typeLabel;
                    const concerns = result?.skinProfile?.concerns || result?.concerns || [];
                    const skinAge = result?.skinProfile?.skinAge || result?.faceAnalysis?.skinAge;
                    const dateInfo = formatDate(session.completedAt);

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
                              <div className="text-[12px] text-[#8A8A8A]">{dateInfo.relative}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[#1A1A1A]">
                            <span className="text-lg font-semibold">{score ?? "—"}</span>
                            {score && <span className="text-[11px] text-[#8A8A8A]">分</span>}
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
                          {skinAge && (
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
                    disabled={page <= 1 || loadingHistory}
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
                    disabled={page >= totalPages || loadingHistory}
                    className="flex items-center gap-1.5 text-[12px] text-[#8A8A8A] hover:text-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </m.section>

            {/* Logout */}
            <div className="px-6 md:px-8 pb-8 text-center">
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#8A8A8A] hover:text-[#1A1A1A] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出登录
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-8 px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs tracking-widest text-[#5E5E5E]/60">
            <p>© {new Date().getFullYear()} NIHPLOD. All Rights Reserved.</p>
            <span className="hidden sm:inline text-[#5E5E5E]/30">·</span>
            <div className="flex items-center gap-4">
              <Link href="https://nihplod.cn/privacy" className="hover:text-[#3D4430] transition-colors duration-300">
                隐私政策
              </Link>
              <span className="text-[#5E5E5E]/30">·</span>
              <Link href="https://nihplod.cn/terms" className="hover:text-[#3D4430] transition-colors duration-300">
                服务条款
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </LazyMotion>
  );
}
