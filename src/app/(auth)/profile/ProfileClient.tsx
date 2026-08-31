"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { Link } from "next-view-transitions";
import {
  Loader2,
  ScanFace,
  LogOut,
  Smartphone,
  Camera,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { LazyMotion, domAnimation, m } from "framer-motion";
import Image from "next/image";
import { TestHistoryList, type HistorySession } from "@/components/website/TestHistoryList";
import { getCharacterImage, getSkinTypeName } from "@/lib/result-utils";

export default function ProfileClient() {
  const { user, loading, logout, refresh } = useAuth();
  const toast = useToast();
  const router = useRouter();
  // 测肤记录当前页数据（由 TestHistoryList 拉取后回调，仅用于统计行）
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const maskPhone = (phone?: string | null) => {
    if (!phone) return "—";
    if (phone.length <= 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    // 客户端预校验：类型与大小，避免无效上传请求
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("仅支持 JPG / PNG / WebP / GIF 格式的图片");
      e.target.value = "";
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error("图片大小不能超过 5MB");
      e.target.value = "";
      return;
    }
    setUpdatingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetchWithCsrf("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error || "上传未成功");

      const updateRes = await fetchWithCsrf("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: uploadData.url }),
      });
      if (!updateRes.ok) throw new Error("保存未成功");
      await refresh();
    } catch (err) {
      console.error("Avatar update error:", err);
      toast.error(err instanceof Error ? err.message : "头像更新未成功");
    } finally {
      setUpdatingAvatar(false);
      // 清空 input，保证选择同一文件也能再次触发 change
      e.target.value = "";
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = editedName.trim();
    if (!trimmed) return;
    try {
      const res = await fetchWithCsrf("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("保存未成功");
      await refresh();
      setIsEditingName(false);
    } catch (err) {
      console.error("Name update error:", err);
      toast.error("昵称更新未成功");
    }
  };

  const startEditName = () => {
    setEditedName(user?.name || "");
    setIsEditingName(true);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/?auth=login&redirect=/profile");
    }
  }, [user, loading, router]);

  // 测肤记录拉取与分页由 TestHistoryList 自管理，这里只接收当前页数据用于统计行
  const handleHistoryData = useCallback((sessions: HistorySession[]) => {
    setHistorySessions(sessions);
  }, []);

  const handleLogout = async () => {
    // logout 内部已完成整页跳转，无需再 router.push
    await logout();
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A86C] animate-spin" />
      </div>
    );
  }

  const latestResult = historySessions[0]?.analysisResult;
  // 平均评分只对实际有评分的记录求平均；无评分记录不计入，全部无评分时显示"—"
  const scoredSessions = historySessions.filter(
    (s) => typeof s.analysisResult?.faceAnalysis?.overallScore === "number"
  );
  const avgScore =
    scoredSessions.length > 0
      ? Math.round(
          scoredSessions.reduce(
            (sum, s) => sum + (s.analysisResult?.faceAnalysis?.overallScore ?? 0),
            0
          ) / scoredSessions.length
        )
      : null;

  const latestSkinTypeCode = latestResult?.skinProfile?.type;
  // 无评分记录时保持 null，UI 显示"—"
  const latestScore = latestResult?.faceAnalysis?.overallScore ?? null;
  const latestSkinTypeName = latestScore && latestSkinTypeCode
    ? getSkinTypeName({ score: latestScore, skinType: latestSkinTypeCode })
    : null;
  const latestCharacterImage = latestScore && latestSkinTypeCode
    ? getCharacterImage({ score: latestScore, skinType: latestSkinTypeCode, gender: "female" })
    : null;

  const avatarUrl = user?.avatar;

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#FDFBF7] text-[#1A1A1A]">
        {/* 顶部导航已移除，由根 layout 的 BottomDock 统一承担导航 */}

        {/* layout 已提供唯一 <main> 地标，这里用 div 避免嵌套 */}
        <div className="pt-6 md:pt-10 pb-dock">
          <div className="max-w-2xl mx-auto">
            {/* Cover */}
            <div className="relative h-40 md:h-52 bg-gradient-to-br from-[#E8E4D9] via-[#F0EDE3] to-[#E8E4D9]" />

            {/* Avatar + basic info */}
            <div className="relative px-6 md:px-8 pb-5">
              <div className="flex justify-between items-end -mt-16 md:-mt-20 mb-4">
                <label className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-[#ECEBE6] border-4 border-[#FDFBF7] cursor-pointer group shadow-lg">
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
                      disabled={!editedName.trim()}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-[rgba(61,68,48,0.06)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="保存昵称"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-[rgba(61,68,48,0.06)] transition-colors"
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
              {/* 注：User 接口暂无 createdAt 字段，"加入时间"待后端补充后再展示 */}
              <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#5E5E5E] mb-4">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{maskPhone(user.phone)}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 text-[14px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#1A1A1A]">{historySessions.length}</span>
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
              <TestHistoryList title="测肤记录" onDataChange={handleHistoryData} />
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
        </div>

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
