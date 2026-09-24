"use client";

import Image from "next/image";
import { createElement, useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, Loader2, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { useDiaryModal } from "@/components/website/DiaryModalContext";
import { getFactionIcon } from "@/components/website/faction-icons";
import { getSkinTypeByIpKey } from "@/lib/result-content";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { uploadImage } from "@/lib/upload-client";
import type { User } from "@/components/auth/UserProvider";
import type { HistorySession } from "@/components/website/TestHistoryList";

/** GET /api/account/profile 响应（仅取昵称/头像展示，其余字段不需要） */
interface AccountProfile {
  nickname: string | null;
  avatar: string | null;
}

/** /api/advisor/test-limit 的 usage 字段（登录用户） */
interface TestUsage {
  totalUsed: number;
  todayUsed: number;
  lifetimeLimit: number | null;
  dailyLimit: number | null;
  unlimited: boolean;
}

interface AccountRootViewProps {
  user: User;
  onClose: () => void;
  onRequestLogout: () => void;
  /** 会话过期时的登录引导：由 AccountModal 统一处理（先关弹层再开 AuthModal，避免层级/焦点冲突） */
  onRequestLogin: () => void;
}

/**
 * 「个人信息」面板（排版对齐官网 ProfilePanel）：
 * 左对齐头像区（头像 + 昵称 + 点击更换头像）+ 行式信息列表（昵称可编辑 /
 * 肌智派形象 / 测肤用量 / 护肤档案入口）+ 移动端退出登录。
 * 手机号/生日/性别由会员中心承载，此处不展示。
 */
export function AccountRootView({ user, onClose, onRequestLogout, onRequestLogin }: AccountRootViewProps) {
  const { openDiaryModal } = useDiaryModal();
  const { refresh } = useAuth();
  const toast = useToast();

  // 测肤用量 / 最新测肤派系（接口失败静默不展示）；账号切换时重新拉取
  const [testUsage, setTestUsage] = useState<TestUsage | null>(null);
  const [latestPersona, setLatestPersona] = useState<string | null>(null);
  // 两个静默接口都结束（含失败）才收起骨架，避免"加载完才出现"导致下方内容跳动
  const [metaLoaded, setMetaLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTestUsage(null);
    setLatestPersona(null);
    setMetaLoaded(false);
    Promise.allSettled([
      fetch("/api/advisor/test-limit")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.usage) setTestUsage(data.usage as TestUsage);
        }),
      fetch("/api/advisor/history?page=1&limit=1&lite=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled) return;
          const latest = (data?.history as HistorySession[] | undefined)?.[0];
          const persona = (latest?.analysisResult as { persona?: string } | undefined)?.persona;
          setLatestPersona(persona ?? null);
        }),
    ]).then(() => {
      if (!cancelled) setMetaLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user.id]);

  // 主站资料（BFF）：拉取失败时回退展示 UserProvider 的会话字段
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  // 保存进行态（防重复提交）：avatar / nickname
  const [saving, setSaving] = useState<string | null>(null);
  // 保存互斥锁用 ref：state 闭包在连续事件里可能读到旧值，ref 才是可靠锁
  const savingRef = useRef(false);
  // 会话过期（BFF 返回 401）：本地 user 态未同步时的兜底引导
  const [sessionExpired, setSessionExpired] = useState(false);

  // 昵称行内编辑
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // 账号切换时先清空旧数据，避免重取期间展示上一账号的内容
    setProfile(null);
    setSessionExpired(false);
    fetch("/api/account/profile")
      .then((r) => {
        if (r.status === 401) {
          if (!cancelled) setSessionExpired(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!cancelled && data) setProfile(data as AccountProfile);
      })
      .catch(() => { /* 回退到会话字段展示 */ });
    return () => { cancelled = true; };
    // 账号切换（user.id 变化）时重新拉取，避免展示上一账号的残留数据
  }, [user.id]);

  /** PATCH /api/account/profile 的请求本体（不含互斥锁）；成功后刷新会话用户态 */
  const requestProfilePatch = async (
    body: { nickname?: string; avatar?: string }
  ): Promise<boolean> => {
    try {
      const res = await fetchWithCsrf("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setSessionExpired(true);
        toast.error("登录状态已过期，请重新登录");
        return false;
      }
      if (!res.ok) {
        toast.error("保存未成功，请稍后再试");
        return false;
      }
      const data = (await res.json().catch(() => null)) as AccountProfile | null;
      if (data) setProfile(data);
      toast.success("已保存");
      // 同步 UserProvider 会话用户态（昵称/头像全站可见）
      await refresh();
      return true;
    } catch {
      toast.error("网络异常，保存未成功");
      return false;
    }
  };

  /** 带互斥锁的保存入口（ref 锁：state 闭包在连续事件里可能读到旧值） */
  const patchProfile = async (
    body: { nickname?: string; avatar?: string },
    field: string
  ): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(field);
    try {
      return await requestProfilePatch(body);
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || savingRef.current) return;
    // 上传与 PATCH 同一把锁、同一个 saving 态：避免上传完成到 PATCH 之间出现空窗
    savingRef.current = true;
    setSaving("avatar");
    try {
      const url = await uploadImage(file, file.name || "avatar.jpg");
      await requestProfilePatch({ avatar: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "头像上传未成功，请稍后再试");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const startEditNickname = () => {
    setNicknameDraft(profile?.nickname || user.name || "");
    setEditingNickname(true);
  };

  const saveNickname = async () => {
    const nickname = nicknameDraft.trim();
    if (!nickname) {
      toast.warning("昵称不能为空");
      return;
    }
    if (nickname === (profile?.nickname || user.name || "")) {
      setEditingNickname(false);
      return;
    }
    const ok = await patchProfile({ nickname }, "nickname");
    if (ok) setEditingNickname(false);
  };

  const latestPersonaType = latestPersona ? getSkinTypeByIpKey(latestPersona) : null;
  // 空串（历史脏数据/无昵称）同样回退，避免面板标题显示空白
  const displayName = profile?.nickname || user.name || "朋友";
  const displayAvatar = profile?.avatar ?? user.avatar;

  return (
    <div className="flex h-full flex-col pt-4 md:pt-10">
      {/* 标题 - 移动端由弹窗全局 Header 管理 */}
      <div className="hidden flex-shrink-0 border-b-0 border-stone-200/60 px-6 pb-6 md:flex md:border-b md:px-16">
        <h2 className="text-xl font-medium tracking-wide text-stone-800">个人信息</h2>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto overscroll-contain px-6 py-6 md:px-16">
        {/* 会话过期（BFF 401）：本地 user 态未同步时的兜底引导 */}
        {sessionExpired && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900"
          >
            <span>登录状态已过期，资料信息可能不是最新</span>
            <button
              type="button"
              onClick={onRequestLogin}
              className="shrink-0 h-7 px-3 rounded-full border border-amber-300 bg-white/70 text-[12px] hover:bg-white transition-colors cursor-pointer"
            >
              重新登录
            </button>
          </div>
        )}

        {/* 头像区域：点击更换头像（上传 OSS 后 PATCH 主站资料） */}
        <div className="mb-5 flex items-center gap-4 md:mb-10 md:gap-6">
          <div className="group relative">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={saving !== null}
              aria-label="更换头像"
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-[#FBF8F0]/20 transition-all group-hover:border-stone-300 md:h-20 md:w-20 cursor-pointer disabled:cursor-wait"
            >
              {displayAvatar ? (
                <Image src={displayAvatar} alt="" fill unoptimized className="object-cover" />
              ) : (
                <UserIcon className="h-7 w-7 text-stone-400 md:h-8 md:w-8" strokeWidth={1} />
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-all group-hover:bg-black/30">
                {saving === "avatar" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-800">{displayName}</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={saving !== null}
              className="mt-1 text-xs text-stone-400 transition-colors hover:text-stone-800 cursor-pointer disabled:opacity-50"
            >
              {saving === "avatar" ? "上传中..." : "点击更换头像"}
            </button>
          </div>
        </div>

        {/* 信息行列表（行式排版：左侧字段名 + 值，右侧操作；移动端行间细分隔线） */}
        <div className="flex flex-col gap-1">
          {/* 昵称 */}
          <div className="group -mx-6 flex items-center justify-between rounded-2xl px-6 py-4 transition-all hover:bg-white/40">
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">昵称</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                {editingNickname ? (
                  <input
                    type="text"
                    value={nicknameDraft}
                    maxLength={20}
                    autoFocus
                    aria-label="昵称"
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveNickname();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditingNickname(false);
                      }
                    }}
                    className="w-full border-b border-stone-400 bg-transparent py-1 text-base font-medium text-stone-800 outline-none transition-colors placeholder:text-stone-300 md:w-56"
                  />
                ) : (
                  <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">{displayName}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editingNickname ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingNickname(false)}
                    disabled={saving !== null}
                    className="text-xs font-light text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveNickname}
                    disabled={saving !== null}
                    className="text-xs font-medium text-stone-800 transition-colors hover:text-stone-500 disabled:opacity-50 cursor-pointer"
                  >
                    {saving === "nickname" ? "保存中..." : "保存"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditNickname}
                  className="group -my-2 flex items-center gap-1.5 py-2 text-xs font-light text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer"
                >
                  <span className="opacity-100 md:opacity-0 md:group-hover:opacity-100">修改</span>
                  <ChevronRight className="h-3.5 w-3.5 text-stone-300 md:hidden" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 肌智派形象（最新一次测肤派系） */}
          <div className="group -mx-6 flex items-center justify-between rounded-2xl px-6 py-4 transition-all hover:bg-white/40">
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">肌智派形象</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                {!metaLoaded ? (
                  <div aria-hidden className="h-4 w-24 rounded-full bg-stone-200/60 animate-pulse" />
                ) : latestPersonaType ? (
                  <p className="flex items-center gap-2 truncate text-[15px] font-medium text-stone-800 md:text-sm">
                    {createElement(getFactionIcon(latestPersonaType.ipKey), {
                      className: "h-4 w-4 shrink-0 text-stone-400",
                      strokeWidth: 1.5,
                    })}
                    {latestPersonaType.typeName}
                  </p>
                ) : (
                  <p className="text-[15px] text-stone-400 md:text-sm">尚未测肤</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 测肤用量：普通/银卡显示终身用量，金卡/钻石不限次显示当日用量 */}
          <div className="group -mx-6 flex items-center justify-between rounded-2xl px-6 py-4 transition-all hover:bg-white/40">
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">测肤用量</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                {!metaLoaded ? (
                  <div aria-hidden className="h-4 w-32 rounded-full bg-stone-200/60 animate-pulse" />
                ) : (
                  <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">
                    {testUsage
                      ? testUsage.unlimited
                        ? `不限次（今日已用 ${testUsage.todayUsed}/${testUsage.dailyLimit ?? 10}）`
                        : `已用 ${testUsage.totalUsed} / 共 ${testUsage.lifetimeLimit ?? 10} 次`
                      : "—"}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 护肤档案入口 */}
          <button
            type="button"
            onClick={() => {
              onClose();
              openDiaryModal();
            }}
            className="group -mx-6 flex w-full items-center justify-between rounded-2xl px-6 py-4 text-left transition-all hover:bg-white/40 cursor-pointer"
          >
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">护肤档案</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">测肤记录与每日打卡</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 移动端退出登录（桌面端在用户中心侧边栏） */}
        <div className="mt-8 md:hidden">
          <button
            type="button"
            onClick={onRequestLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white/40 py-3 text-sm text-stone-500 transition-colors hover:bg-white/70 hover:text-stone-700 active:opacity-70 cursor-pointer"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
