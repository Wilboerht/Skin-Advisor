"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { Camera, Check, CircleUserRound, Loader2, LogOut, Pencil, Smartphone, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { useToast } from "@/components/ui/Toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function maskPhone(phone?: string | null) {
  if (!phone) return "—";
  if (phone.length <= 7) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

/**
 * AccountModal — 「我的」账户弹层（替代原 /profile 独立页）
 * 已登录：头像（可更换）、昵称（可编辑）、手机号、退出登录。
 * 未登录：登录引导视图，点击按钮走 SSO 统一登录。
 * 容器/动效/关闭按钮与 GiftModal 等全站模态框对齐；测肤记录在 /diary 页查看。
 */
export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, refresh, logout, login } = useAuth();
  const toast = useToast();
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  useBodyScrollLock({ enabled: isOpen, iosSafe: true });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
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

  const handleLogout = async () => {
    onClose();
    // logout 内部已完成整页跳转，无需再处理路由
    await logout();
  };

  const handleLogin = () => {
    // 整页跳转到账号中心，弱网下需数秒——先给出即时反馈，避免用户误以为没点上而连点
    toast.info("正在前往 NIHPLOD 账号中心…");
    login();
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            {/* 背景遮罩 */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* 弹窗主体：移动端底部升起，桌面端居中 */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-sm bg-[#FDFBF7] rounded-t-[28px] sm:rounded-[28px] shadow-[0_45px_80px_-16px_rgba(0,0,0,0.15)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                aria-label="关闭"
                className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-brand-charcoal/5 text-brand-charcoal/40 hover:text-brand-charcoal hover:bg-brand-charcoal/10 transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>

              <div className="px-6 md:px-8 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:pt-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-8 flex flex-col items-center">
                <h2 id="account-modal-title" className="sr-only">
                  我的账户
                </h2>

                {!user ? (
                  <>
                    {/* 未登录引导视图 */}
                    <CircleUserRound className="w-20 h-20 text-brand-charcoal mb-6" strokeWidth={1} />
                    <h3 className="text-2xl font-serif font-light text-brand-charcoal tracking-[0.08em] mb-3">
                      登录肌智派
                    </h3>
                    <p className="text-[13px] text-brand-charcoal/60 font-light leading-[1.8] tracking-[0.06em] text-center mb-8">
                      登录后同步你的测肤记录与护肤档案
                      <br />
                      随时随地延续你的护肤旅程
                    </p>
                    <button
                      onClick={handleLogin}
                      className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-[#5c4937] text-[#FDFBF7] text-[13px] tracking-[0.12em] font-light cursor-pointer transition-colors duration-300 hover:bg-[#4a3a2c]"
                    >
                      登录 / 注册
                    </button>
                  </>
                ) : (
                  <>
                {/* 头像（点击更换） */}
                <label className="relative w-24 h-24 rounded-full overflow-hidden bg-[#ECEBE6] cursor-pointer group shadow-md mb-4">
                  {user?.avatar ? (
                    <Image src={user.avatar} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-[#8A8A8A]">
                      {(user?.name?.[0] || "?").toUpperCase()}
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

                {/* 昵称（就地编辑） */}
                {isEditingName ? (
                  <div className="flex items-center gap-2 mb-1.5">
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
                      className="w-40 px-3 py-1.5 text-lg text-center font-semibold text-[#1A1A1A] bg-white border border-brand-charcoal/[0.12] rounded-lg focus:outline-none focus:border-brand-charcoal/50"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={!editedName.trim()}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-brand-charcoal/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="保存昵称"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[#5E5E5E] hover:text-[#1A1A1A] hover:bg-brand-charcoal/[0.06] transition-colors"
                      aria-label="取消"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-xl font-semibold text-[#1A1A1A]">
                      {user?.name || "朋友"}
                    </p>
                    <button
                      onClick={() => {
                        setEditedName(user?.name || "");
                        setIsEditingName(true);
                      }}
                      className="p-1.5 rounded-full text-[#8A8A8A] hover:text-brand-charcoal hover:bg-brand-charcoal/[0.06] transition-colors"
                      aria-label="编辑昵称"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* 手机号 */}
                <div className="flex items-center gap-1.5 text-[13px] text-[#5E5E5E] mb-8">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{maskPhone(user?.phone)}</span>
                </div>

                {/* 退出登录 */}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 text-[13px] tracking-[0.05em] text-[#8A8A8A] hover:text-[#1A1A1A] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出登录
                </button>
                  </>
                )}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
