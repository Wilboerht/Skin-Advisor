"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronRight, Loader2, Lock, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { PasswordSection } from "@/components/website/account-sections/PasswordSection";
import { AddressSection } from "@/components/website/account-sections/AddressSection";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { localDateStr } from "@/lib/local-date";
import { uploadImage } from "@/lib/upload-client";
import type { User } from "@/components/auth/UserProvider";

/** 手机号打码：BFF 未返回时回退会话字段，避免在面板上展示完整号码；
 *  已是掩码则原样返回，非手机号格式（如微信占位号 wx_ 前缀）视为未绑定 */
function maskPhoneForDisplay(phone?: string | null): string | null {
  if (!phone) return null;
  if (/^\d{3}\*+\d{4}$/.test(phone)) return phone;
  if (!/^1[3-9]\d{9}$/.test(phone)) return null;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/** GET /api/account/profile 响应（BFF 转发主站资料：昵称/头像/性别/打码手机号/会员等级/生日） */
interface AccountProfile {
  nickname: string | null;
  avatar: string | null;
  /** 性别（主站 gender claim）；null/未同步 = 保密 */
  gender?: "male" | "female" | null;
  /** 打码手机号（如 138****1234）；未绑定为 null */
  phone?: string | null;
  membershipLevel?: string | null;
  /** 生日（YYYY-MM-DD）：本地 DB 无字段，由 BFF 回源主站 userinfo，不可达时降级为 null */
  birthday?: string | null;
  /** 是否已设置密码（主站 userinfo has_password，profile scope）；null = 官网未返回 */
  hasPassword?: boolean | null;
}

/** PATCH /api/account/profile 请求体（BFF 转发主站 userinfo，成功后回传同名结果） */
type ProfilePatchBody = {
  nickname?: string;
  avatar?: string;
  gender?: "male" | "female" | null;
  birthday?: string | null;
};

interface AccountRootViewProps {
  user: User;
  onRequestLogout: () => void;
  /** 会话过期时的登录引导：由 AccountModal 统一处理（先关弹层再开 AuthModal，避免层级/焦点冲突） */
  onRequestLogin: () => void;
}

/**
 * 「个人信息」面板（排版对齐官网 ProfilePanel）：
 * 左对齐头像区（头像 + 昵称 + 点击更换头像）+ 行式信息列表
 * （昵称/性别/生日可编辑，绑定手机号打码展示，密码可设置/修改，收货地址可增删改）+ 移动端退出登录。
 * 昵称/头像/性别/生日经 BFF（/api/account/profile）转发主站修改；手机号仅打码展示（换绑在主站）；
 * 密码经 BFF 转发主站；收货地址经 BFF 代理主站 OAuth 地址簿（单一数据源）。
 */
export function AccountRootView({ user, onRequestLogout, onRequestLogin }: AccountRootViewProps) {
  const { refresh } = useAuth();
  const toast = useToast();

  // 主站资料（BFF）：拉取失败时回退展示 UserProvider 的会话字段
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  // 保存进行态（防重复提交）：avatar / nickname
  const [saving, setSaving] = useState<string | null>(null);
  // 保存互斥锁用 ref：state 闭包在连续事件里可能读到旧值，ref 才是可靠锁
  const savingRef = useRef(false);
  // 会话过期（BFF 返回 401）：本地 user 态未同步时的兜底引导
  const [sessionExpired, setSessionExpired] = useState(false);
  // 会话过期回调：引用必须稳定——子组件（密码/地址区块）把它作为 effect 依赖，
  // 内联箭头会导致其请求 effect 反复重建 → 重复拉取
  const handleSessionExpired = useCallback(() => setSessionExpired(true), []);

  // 昵称行内编辑
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  // 性别/生日行内编辑：性别点击即存；生日仅未设置时可设（主站设置后锁定）
  const [editingGender, setEditingGender] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState("");
  // 密码 / 收货地址行内展开（对齐主站个人信息面板的收起-展开行）
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  // 收货地址数量（行内展示 已设置/未设置；展开区增删改后回报）
  const [addressCount, setAddressCount] = useState<number | null>(null);
  // 生日被主站锁定但官网回源不可达（日期降级为 null）：行内展示「已锁定（日期暂不可见）」
  const [birthdayLockedHint, setBirthdayLockedHint] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 资料读请求序号：账号切换/连续重取时作废旧响应，避免写回串场
  const profileSeqRef = useRef(0);

  /** 拉取主站资料（BFF）；失败静默回退会话字段展示 */
  const loadProfile = useCallback(async () => {
    const seq = ++profileSeqRef.current;
    try {
      const res = await fetch("/api/account/profile");
      if (seq !== profileSeqRef.current) return;
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as AccountProfile;
      if (seq === profileSeqRef.current) setProfile(data);
    } catch {
      /* 回退到会话字段展示 */
    }
  }, []);

  useEffect(() => {
    // 账号切换时先清空旧数据，避免重取期间展示上一账号的内容
    setProfile(null);
    setSessionExpired(false);
    void loadProfile();
    // 账号切换（user.id 变化）时重新拉取，避免展示上一账号的残留数据
  }, [user.id, loadProfile]);

  // 账号切换：收起所有行内编辑/展开区，避免沿用上一账号的编辑态
  useEffect(() => {
    setEditingNickname(false);
    setEditingGender(false);
    setEditingBirthday(false);
    setPasswordOpen(false);
    setAddressOpen(false);
    setBirthdayLockedHint(false);
  }, [user.id]);

  // 「收货地址」行状态：挂载时轻量拉取一次数量（地址簿很小）；展开区增删改后回报最新数量
  useEffect(() => {
    let cancelled = false;
    setAddressCount(null);
    fetch("/api/account/addresses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = (data as { data?: { addresses?: unknown[] } } | null)?.data?.addresses;
        if (Array.isArray(list)) setAddressCount(list.length);
      })
      .catch(() => { /* 静默：行内显示 —，展开区自带错误态与重试 */ });
    return () => { cancelled = true; };
  }, [user.id]);

  /** PATCH /api/account/profile 的请求本体（不含互斥锁）；成功后刷新会话用户态 */
  const requestProfilePatch = async (
    body: ProfilePatchBody
  ): Promise<{ ok: boolean; errorCode?: string }> => {
    try {
      const res = await fetchWithCsrf("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        setSessionExpired(true);
        toast.error("登录状态已过期，请重新登录");
        return { ok: false };
      }
      if (!res.ok) {
        // 透传服务端可读原因（如生日已锁定 birthday_locked / 校验失败），否则回退通用文案
        const errBody = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
        toast.error(errBody?.message || "保存未成功，请稍后再试");
        return { ok: false, errorCode: errBody?.error };
      }
      const data = (await res.json().catch(() => null)) as Partial<AccountProfile> | null;
      // 合并而非替换：PATCH 只回传被修改的字段（昵称/头像/性别/生日），
      // 替换会把 phone/membershipLevel 等读接口字段清掉
      if (data) setProfile((prev) => (prev ? { ...prev, ...data } : (data as AccountProfile)));
      toast.success("已保存");
      // 同步 UserProvider 会话用户态（昵称/头像/性别全站可见）
      await refresh();
      return { ok: true };
    } catch {
      toast.error("网络异常，保存未成功");
      return { ok: false };
    }
  };

  /** 带互斥锁的保存入口（ref 锁：state 闭包在连续事件里可能读到旧值） */
  const patchProfile = async (
    body: ProfilePatchBody,
    field: string
  ): Promise<{ ok: boolean; errorCode?: string }> => {
    if (savingRef.current) return { ok: false };
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
    setEditingGender(false);
    setEditingBirthday(false);
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
    const result = await patchProfile({ nickname }, "nickname");
    if (result.ok) setEditingNickname(false);
  };

  /** 性别：三态（男/女/保密，null=保密），点击即保存 */
  const saveGender = async (value: "male" | "female" | null) => {
    // 与当前值相同（如保密再点保密）：不重复提交，直接收起编辑态
    if (value === genderValue) {
      setEditingGender(false);
      return;
    }
    const result = await patchProfile({ gender: value }, "gender");
    if (result.ok) setEditingGender(false);
  };

  /** 生日：仅未设置时可设置（主站设置后锁定，失败原因由 BFF 透传 toast） */
  const saveBirthday = async () => {
    if (!birthdayDraft) {
      toast.warning("请选择生日日期");
      return;
    }
    if (birthdayDraft > localDateStr(new Date())) {
      toast.warning("生日不能晚于今天");
      return;
    }
    const result = await patchProfile({ birthday: birthdayDraft }, "birthday");
    if (result.ok) {
      setEditingBirthday(false);
      setBirthdayLockedHint(false);
    } else {
      // 失败多为「已被设置并锁定」：收起编辑态、标记锁定提示并回源刷新
      //（官网回源不可达时日期仍为 null，行内降级展示「已锁定（日期暂不可见）」，避免误显示成「未设置」）
      if (result.errorCode === "birthday_locked") {
        setBirthdayLockedHint(true);
        setEditingBirthday(false);
      }
      void loadProfile();
    }
  };

  // 空串（历史脏数据/无昵称）同样回退，避免面板标题显示空白
  const displayName = profile?.nickname || user.name || "朋友";
  const displayAvatar = profile?.avatar ?? user.avatar;
  // 性别：BFF 资料优先（含主站 claim）；资料未加载/字段缺失（undefined）时回退会话字段，null = 保密
  const genderValue = profile?.gender !== undefined ? profile.gender ?? null : user.gender ?? null;
  const genderLabel = genderValue === "male" ? "男" : genderValue === "female" ? "女" : "保密";
  // 手机号：BFF 打码返回优先；回退会话字段时同样打码（会话里的 phoneNumber 是完整号码）
  const phoneLabel = maskPhoneForDisplay(profile?.phone || user.phone) || "未绑定";
  // 密码：已设置/未设置；官网未返回（null/undefined）时显示 —，表单按「修改」起步并靠 PASSWORD_NOT_SET 兜底
  const passwordLabel =
    profile?.hasPassword === true ? "已设置" : profile?.hasPassword === false ? "未设置" : "—";
  // 收货地址：挂载时轻量拉一次数量（地址簿很小）；展开区增删改后会回报最新数量
  const addressLabel = addressCount === null ? "—" : addressCount > 0 ? "已设置" : "未设置";

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

          {/* 性别：男/女/保密三态，点击即保存（对齐主站个人信息面板） */}
          <div className="group -mx-6 rounded-2xl px-6 transition-all hover:bg-white/40">
            <div className="flex items-center justify-between py-4">
              <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
                <div className="w-[4.5rem] shrink-0 md:w-20">
                  <p className="text-[13px] text-stone-400 md:text-sm md:font-light">性别</p>
                </div>
                <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                  <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">{genderLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingBirthday(false);
                  setEditingGender((v) => !v);
                }}
                aria-expanded={editingGender}
                className="group -my-2 flex shrink-0 items-center gap-1.5 py-2 text-xs font-light text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer"
              >
                <span className="opacity-100 md:opacity-0 md:group-hover:opacity-100">修改</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-300 md:hidden" />
              </button>
            </div>
            {editingGender && (
              <div className="max-w-md border-t border-stone-200/60 pb-5 pt-4">
                <p className="mb-3 text-xs text-stone-400">用于会员服务与个性化推荐；可随时修改或设为保密。</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "male", label: "男" },
                      { value: "female", label: "女" },
                      { value: null, label: "保密" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={saving !== null}
                      onClick={() => void saveGender(opt.value)}
                      className={`rounded-full border px-5 py-2 text-sm transition-colors disabled:opacity-50 cursor-pointer ${
                        genderValue === opt.value
                          ? "border-[#00263e] bg-[#00263e] text-white"
                          : "border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditingGender(false)}
                    disabled={saving !== null}
                    className="rounded-full px-3 py-2 text-xs font-light text-stone-500 transition-colors hover:text-stone-800 disabled:opacity-50 cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 生日：主站仅允许设置一次，设置后显示「已锁定」（对齐主站个人信息面板） */}
          <div className="group -mx-6 flex items-center justify-between rounded-2xl px-6 py-4 transition-all hover:bg-white/40">
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">生日</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                {editingBirthday ? (
                  <input
                    type="date"
                    value={birthdayDraft}
                    autoFocus
                    aria-label="生日"
                    onChange={(e) => setBirthdayDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveBirthday();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditingBirthday(false);
                      }
                    }}
                    className="w-full border-b border-stone-400 bg-transparent py-1 text-base font-medium text-stone-800 outline-none transition-colors md:w-56"
                  />
                ) : (
                  <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">
                    {profile?.birthday
                      ? profile.birthday.slice(0, 10)
                      : birthdayLockedHint
                        ? "已锁定（日期暂不可见）"
                        : "未设置"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editingBirthday ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingBirthday(false)}
                    disabled={saving !== null}
                    className="text-xs font-light text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={saveBirthday}
                    disabled={saving !== null}
                    className="text-xs font-medium text-stone-800 transition-colors hover:text-stone-500 disabled:opacity-50 cursor-pointer"
                  >
                    {saving === "birthday" ? "保存中..." : "保存"}
                  </button>
                </div>
              ) : profile?.birthday || birthdayLockedHint ? (
                <span className="flex items-center gap-1.5 text-xs font-light text-stone-400">
                  <Lock className="h-3.5 w-3.5" />
                  已锁定
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGender(false);
                    setBirthdayDraft("");
                    setEditingBirthday(true);
                  }}
                  className="group -my-2 flex items-center gap-1.5 py-2 text-xs font-light text-stone-500 transition-colors hover:text-stone-800 active:opacity-60 cursor-pointer"
                >
                  <span className="opacity-100 md:opacity-0 md:group-hover:opacity-100">设置</span>
                  <ChevronRight className="h-3.5 w-3.5 text-stone-300 md:hidden" />
                </button>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 绑定手机号：主站 userinfo 打码返回，仅展示（换绑走主站短信验证，独立站不提供） */}
          <div className="group -mx-6 flex items-center justify-between rounded-2xl px-6 py-4">
            <div className="mr-4 flex min-w-0 flex-1 items-center gap-3 md:gap-6">
              <div className="w-[4.5rem] shrink-0 md:w-20">
                <p className="text-[13px] text-stone-400 md:text-sm md:font-light">绑定手机号</p>
              </div>
              <div className="flex w-full min-w-0 flex-1 items-center gap-2">
                <p className="truncate text-[15px] font-medium text-stone-800 md:text-sm">{phoneLabel}</p>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 密码：已设置/未设置 + 行内展开修改/首次设置（对齐主站个人信息面板） */}
          <div className="group -mx-6 rounded-2xl px-6 transition-all hover:bg-white/40">
            <button
              type="button"
              onClick={() => setPasswordOpen((v) => !v)}
              aria-expanded={passwordOpen}
              className="flex w-full items-center justify-between py-4 cursor-pointer"
            >
              <div className="flex items-center gap-3 md:gap-6">
                <div className="w-[4.5rem] shrink-0 md:w-20">
                  <p className="text-left text-[13px] text-stone-400 md:text-sm md:font-light">密码</p>
                </div>
                <div>
                  <p className="text-[15px] font-medium text-stone-800 md:text-sm">{passwordLabel}</p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${
                  passwordOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {passwordOpen && (
              <div className="border-t border-stone-200/60 pb-5 pt-4">
                <PasswordSection
                  hasPassword={profile?.hasPassword}
                  onUpdated={() => void loadProfile()}
                  onSessionExpired={handleSessionExpired}
                />
              </div>
            )}
          </div>

          <div className="h-px w-full bg-stone-100 opacity-40 md:hidden" />

          {/* 收货地址：积分兑礼寄送用；数据源为主站地址簿（BFF 代理，单一数据源） */}
          <div className="group -mx-6 rounded-2xl px-6 transition-all hover:bg-white/40">
            <button
              type="button"
              onClick={() => setAddressOpen((v) => !v)}
              aria-expanded={addressOpen}
              className="flex w-full items-center justify-between py-4 cursor-pointer"
            >
              <div className="flex items-center gap-3 md:gap-6">
                <div className="w-[4.5rem] shrink-0 md:w-20">
                  <p className="text-left text-[13px] text-stone-400 md:text-sm md:font-light">收货地址</p>
                </div>
                <div>
                  <p className="text-[15px] font-medium text-stone-800 md:text-sm">{addressLabel}</p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${
                  addressOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {addressOpen && (
              <div className="border-t border-stone-200/60 pb-5 pt-4">
                <AddressSection
                  onSessionExpired={handleSessionExpired}
                  onCountChange={setAddressCount}
                />
              </div>
            )}
          </div>
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
