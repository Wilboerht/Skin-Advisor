"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { advisorStorage } from '@/lib/advisor-storage';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { getModalHistory } from '@/lib/modal-history';
import { SESSION_EXPIRED_EVENT } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

// --- Types ---

export interface User {
    id: string;
    email?: string | null;
    phone?: string | null;
    name?: string;
    role: string;
    avatar?: string | null;
    /** SSO 会员等级（REGULAR 普通/SILVER 银卡/GOLD 金卡/DIAMOND 钻石），null/未知视为普通 */
    membershipLevel?: string | null;
    /** 主站累计消费金额（元），用于 SILVER 银卡测肤加赠 */
    totalSpent?: number | null;
    /** 主站资料性别（male/female），null=未设置；问卷据此预填性别（可一键切换），不当次回写 */
    gender?: "male" | "female" | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isInitialized: boolean;
    // SSO 迁移后所有 credential 参数不再使用（由 nihplod.cn 集中处理），
    // 保留参数签名以维持向后兼容，实际调用均忽略参数
    login: (credentials?: { email?: string; phone?: string; password?: string }) => Promise<void>;
    loginWithCode: (credentials: { phone: string; code: string }) => Promise<void>;
    register: (userData?: { email?: string; phone?: string; password?: string; name?: string; code?: string }) => Promise<void>;
    // 分层退出：默认仅退出本站（local）；传 { global: true } 同时退出所有
    // NIHPLOD 平台（服务端返回 ssoLogoutUrl，整页跳转主站 end-session）
    logout: (options?: { global?: boolean }) => Promise<void>;
    refresh: () => Promise<void>;
}

// --- Context ---

const UserContext = createContext<AuthContextType | undefined>(undefined);

/**
 * BFF 模式的用户会话 Provider。
 *
 * SSO token 全部存于 httpOnly Cookie（浏览器 JS 不可读），前端登录态以
 * 服务端 /api/auth/me 为准：挂载时拉取一次；access_token 过期由该端点
 * 用 refresh_token 静默轮换。
 *
 * 登录/登出均为整页跳转的服务端流程：
 * - login  → /api/auth/login（服务端种 PKCE Cookie 后 302 到主站 authorize）
 * - logout → POST /api/auth/logout（清 SSO + 本地会话 Cookie）成功后整页跳转到
 *   主站登出流程（确认页，清主站 SSO 会话），完成后经 post_logout_redirect_uri 回首页；
 *   登出接口失败时提示并中止——Cookie 未被清除时绝不能假装已退出，
 *   否则下一次 /api/auth/me 会用仍有效的 Cookie 把会话"复活"
 */
// 登出成功回跳提示的 sessionStorage 键（跨主站整页跳转传递，一次性消费）
const LOGOUT_NOTICE_KEY = "nihplod_logout_notice";

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // 登出进行态：点击立即给出全屏反馈（登出链路含多次服务器间往返与主站跳转，
    // 无反馈会显得"点了没反应"）
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const toast = useToast();
    // 单飞：并发 loadUser（挂载 + 定时器 + visibilitychange）共享同一次请求，
    // 避免 /api/auth/me 的 refresh_token 轮换被并发调用打爆
    const inflightRef = useRef<Promise<void> | null>(null);
    // 会话代际：logout 自增，使登出前已发出的在途 loadUser 结果作废，
    // 防止其响应在登出后落地把用户态"复活"
    const sessionGenRef = useRef(0);

    const loadUser = useCallback(async () => {
        if (inflightRef.current) return inflightRef.current;

        const gen = sessionGenRef.current;
        inflightRef.current = (async () => {
        // 10s 超时兜底；超时不视为未登录，保留现有会话状态（避免弱网误踢）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch("/api/auth/me", { cache: "no-store", signal: controller.signal });
            if (!res.ok) {
                // 429 限流 / 5xx 等临时故障不代表已登出，保留现有登录状态，
                // 交给下一次定时续期或操作时再确认
                return;
            }
            const data = (await res.json()) as { user: User | null };
            const nextUser = data.user ?? null;
            // 期间已登出（logout 使代际递增）：丢弃本次结果，不更新用户态
            if (gen !== sessionGenRef.current) {
                return;
            }
            // 内容无变化时不更新引用：/api/auth/me 每次返回新对象，
            // 若直接 setUser 会引发全站消费组件（含已打开的弹层）无谓重渲染/数据重置
            setUser((prev) => {
                if (
                    prev?.id === nextUser?.id &&
                    prev?.name === nextUser?.name &&
                    prev?.avatar === nextUser?.avatar &&
                    prev?.membershipLevel === nextUser?.membershipLevel &&
                    prev?.totalSpent === nextUser?.totalSpent &&
                    prev?.gender === nextUser?.gender &&
                    prev?.role === nextUser?.role
                ) {
                    return prev;
                }
                return nextUser;
            });
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // 请求超时：保持现有登录状态不变
                return;
            }
            // 网络异常（断网/DNS/主站不可达）同样保留现有状态，避免误踢
            return;
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
        })();

        try {
            await inflightRef.current;
        } finally {
            inflightRef.current = null;
        }
    }, []);

    useEffect(() => {
        loadUser();

        // 定时续期：SSO access token 仅 15 分钟，期间若不触发 /api/auth/me
        // 轮换，测肤等长流程中的 API 调用会被误判为未登录。
        // 每 10 分钟（且在页面可见时）静默刷新一次，保持会话活跃。
        const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadUser();
            }
        }, REFRESH_INTERVAL_MS);

        // 从后台切回 / 网络恢复时立即刷新一次，第一时间修复过期会话
        const handleVisible = () => {
            if (document.visibilityState === "visible") {
                loadUser();
            }
        };
        document.addEventListener("visibilitychange", handleVisible);
        window.addEventListener("online", handleVisible);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener("visibilitychange", handleVisible);
            window.removeEventListener("online", handleVisible);
        };
    }, [loadUser]);

    // 登出回跳反馈：从主站登出流程整页跳回后提示一次，并清掉主站回跳附加的 state 参数
    useEffect(() => {
        try {
            if (!sessionStorage.getItem(LOGOUT_NOTICE_KEY)) return;
            sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
        } catch {
            return;
        }
        toast.success("已退出登录");
        const url = new URL(window.location.href);
        if (url.searchParams.has("state")) {
            url.searchParams.delete("state");
            window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        }
    }, [toast]);

    // 会话终结监听：任一接口最终 401（含本地会话重建失败）时立即清态并引导重新登录。
    // 典型场景：他处全局退出（backchannel 已撤销本地 refresh token）后，
    // 本站已打开的页面在用户下次操作时立即感知，而不是等本地 JWT 自然过期。
    // 门禁：仅"当前处于登录态"时反应——游客的公开接口 401（如未登录调 /api/auth/me）不打扰。
    const userRef = useRef<User | null>(null);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        const handleSessionExpired = () => {
            if (!userRef.current) return;
            userRef.current = null;
            // 作废在途 loadUser，防止旧会话响应落地"复活"用户态
            sessionGenRef.current += 1;
            setUser(null);
            toast.error("登录已过期，请重新登录");
            // 走 SSO 登录流程：若仅本地会话失效会静默重登；全局退出则落到主站登录页
            const { pathname, search } = window.location;
            if (pathname === "/login" || pathname === "/register") return;
            getModalHistory().markNavigationPending();
            window.location.href = `/api/auth/login?return_to=${encodeURIComponent(pathname + search)}`;
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    }, [toast]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const login = useCallback(async (_credentials?: { email?: string; phone?: string; password?: string }) => {
        // 登录/注册页自身不作为回跳目标，避免登录成功后回到 /login 再次触发跳转
        const { pathname, search } = window.location;
        const returnTo = pathname === "/login" || pathname === "/register" ? "/" : pathname + search;
        // 立旗：弹层（如「我的」）在点击登录的同一 tick 内关闭时，modal-history 会
        // 程序化 history.back() 清哨兵，与排队中的整页跳转竞争并取消导航（点登录没反应）
        getModalHistory().markNavigationPending();
        window.location.href = `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const loginWithCode = useCallback(async (_credentials: { phone: string; code: string }) => login(), [login]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const register = useCallback(async (_userData?: { email?: string; phone?: string; password?: string; name?: string; code?: string }) => login(), [login]);

    const logout = useCallback(async (options?: { global?: boolean }) => {
        // 先作废在途 loadUser（其响应可能携带登出前的旧会话），再走服务端登出
        sessionGenRef.current += 1;
        setIsLoggingOut(true);

        // POST-only + 同源校验；服务端会清除 SSO Cookie、撤销 refresh_token 并清本地会话
        // 必须确认成功：失败时 Cookie 仍在，若照常跳首页，下一次 /api/auth/me 会把会话复活
        // scope=global 时服务端返回 ssoLogoutUrl（主站 end-session），local 时仅 { ok: true }
        let ssoLogoutUrl: string | null = null;
        try {
            const res = await fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: options?.global ? "global" : "local" }),
            });
            if (!res.ok) {
                toast.error("退出未成功，请稍后再试");
                setIsLoggingOut(false);
                return;
            }
            const data = (await res.json().catch(() => null)) as { ssoLogoutUrl?: string } | null;
            ssoLogoutUrl = typeof data?.ssoLogoutUrl === "string" ? data.ssoLogoutUrl : null;
        } catch {
            toast.error("网络异常，退出未成功，请稍后再试");
            setIsLoggingOut(false);
            return;
        }

        // 隐私清理：登出即清除本机缓存的测肤数据（报告/问卷/面部照片/昵称等），
        // 防止共享设备上下一位使用者看到上一位用户的报告与照片
        try {
            // clearAll 同时清理 IndexedDB（面部照片/结果）与 localStorage 全部测肤键
            await advisorStorage.clearAll();
        } catch { /* 清理失败不阻断登出 */ }
        try {
            // sessionStorage 侧（分析中会话/全局锁等 localStorage 覆盖不到的部分）
            const sessionKeys = [
                STORAGE_KEYS.ADVISOR_ANALYZING_SESSION_ID,
                STORAGE_KEYS.ADVISOR_ANALYZING_STARTED_AT,
                STORAGE_KEYS.ADVISOR_ANALYSIS_LOCK,
                STORAGE_KEYS.LOCATION_CONSENT,
            ];
            for (const key of sessionKeys) {
                try { sessionStorage.removeItem(key); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
        setUser(null);
        // global：整页跳转到主站登出流程（顶层导航携带主站 Cookie，/logout 确认页
        // 能真正清除主站 SSO 会话），完成后经 post_logout_redirect_uri 回到子站首页；
        // local：直接回本站首页
        // 登出成功提示：经主站整页跳转回来后组件已重建，用 sessionStorage 跨导航传递；
        // 在 clearAll 之后写入，避免被登出清理一并抹掉
        try { sessionStorage.setItem(LOGOUT_NOTICE_KEY, "1"); } catch { /* ignore */ }
        // 同 login：整页跳转前立旗，防止弹层关闭的哨兵回退取消导航
        getModalHistory().markNavigationPending();
        window.location.href = ssoLogoutUrl || "/";
    }, [toast]);

    const refresh = useCallback(async () => {
        await loadUser();
    }, [loadUser]);

    const value: AuthContextType = {
        user,
        loading,
        isInitialized: !loading,
        login,
        loginWithCode,
        register,
        logout,
        refresh,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
            {isLoggingOut && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#F5F2E9]">
                    <Loader2 className="h-7 w-7 animate-spin text-stone-500" />
                    <p className="text-sm font-light tracking-wide text-stone-500">正在退出登录…</p>
                </div>
            )}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within UserProvider');
    }
    return context;
}
