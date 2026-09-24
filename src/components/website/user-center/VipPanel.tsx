"use client";

/**
 * 会员中心面板（样式复刻主站 nihplod.cn VipPanel）
 *
 * 数据来源（子站 BFF）：
 * - /api/account/membership：等级/累计消费/权益配置（与主站 getMembershipView 同源）
 * - /api/account/points：积分余额
 * - /api/advisor/test-limit：AI 测肤用量
 *
 * 主视图两栏排版（与主站一致）：
 * - 左栏：当前等级会员卡（四档背景图）+ 当前等级权益列表（超出卡片内滚动）
 * - 右栏：提升引导卡（升级进度/如何提升三步）+ AI 测肤用量卡
 * 「全部等级」入口进入四档对比页（当前/已解锁/未解锁）。
 * 消费补录（录入表单 / 录入历史）为站内实现，经子站 BFF 代理官网 OAuth 端点；
 * 面板首次进入后常驻挂载、以 hidden 切换可见性，草稿在视图间保留。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Bot,
  Cake,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coins,
  Crown,
  Gift,
  Infinity as InfinityIcon,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ScanFace,
  TrendingUp,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { POINTS_CHANGED_EVENT } from "@/lib/fetch-client";
import { SpentAdjustmentPanel, type SpentPanelView } from "@/components/website/user-center/SpentAdjustmentPanel";

// 会员卡背景图（四档）：会员卡铺满作卡面底色，等级对比卡做虚化淡化处理
const CARD_BG_IMAGES: Partial<Record<string, string>> = {
  REGULAR: "/images/membership-card-regular.png",
  SILVER: "/images/membership-card-silver.jpg",
  GOLD: "/images/membership-card-gold.png",
  DIAMOND: "/images/membership-card-diamond.png",
};

// 四档卡片配色（border/gradient/文字）
const TIER_CARD_STYLES: Record<string, { card: string; title: string; bar: string }> = {
  REGULAR: {
    card: "border-stone-200/60 bg-white/40",
    title: "text-stone-800",
    bar: "bg-stone-400",
  },
  SILVER: {
    card: "border-zinc-200/70 bg-gradient-to-br from-zinc-50/80 to-stone-50/40",
    title: "text-zinc-700",
    bar: "bg-zinc-400",
  },
  GOLD: {
    card: "border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-stone-50/40",
    title: "text-amber-800",
    bar: "bg-amber-400",
  },
  DIAMOND: {
    card: "border-indigo-200/70 bg-gradient-to-br from-indigo-50/80 to-stone-50/40",
    title: "text-indigo-800",
    bar: "bg-indigo-400",
  },
};

interface BenefitItem {
  title: string;
  desc: string;
}

// 权益条目图标（按标题适配；未匹配的条目回退 Check）
const BENEFIT_ICONS: Record<string, typeof Check> = {
  测肤体验: ScanFace,
  测肤加赠: ScanFace,
  不限次测肤: InfinityIcon,
  档案永久保留: Archive,
  专属AI护肤顾问: Bot,
  "专属 AI 护肤顾问": Bot,
  积分兑礼: Gift,
  消费积分: Coins,
  会员升级: TrendingUp,
  生日礼遇: Cake,
};

function benefitIcon(title: string): typeof Check {
  return BENEFIT_ICONS[title] ?? Check;
}

// 官方渠道说明文案（点击问号整版切换，避免与步骤列表文案漂移）
const CHANNEL_TIP_TEXT =
  "官方渠道指 NIHPLOD 在天猫国际、抖音商城、小红书、快手、微信小铺等平台开设的官方旗舰店，以及经品牌正式授权的其他线上经销商与线下实体门店。";

interface LevelInfo {
  level: string;
  name: string;
  minSpent: number;
  benefits: BenefitItem[];
}

interface NextLevelInfo {
  name: string;
  spentNeeded: number;
  progress: number;
}

interface SkinTestUsage {
  level: string | null;
  totalUsed: number;
  todayUsed: number;
  quota: {
    lifetimeLimit: number | null;
    dailyLimit: number | null;
    unlimited: boolean;
  };
  remaining: number | null;
}

interface VIPData {
  membershipLevel: string;
  memberId: string;
  totalSpent: number;
  currentLevel: LevelInfo;
  nextLevel: NextLevelInfo | null;
  allLevels: LevelInfo[];
}

interface PointsData {
  available: number;
}

// 内容整版视图：主视图 / 等级对比 / 消费补录表单 · 录入历史，互斥整版切换（淡入淡出）
type VipView = "main" | "levels" | "spent-form" | "spent-history";

interface VipPanelProps {
  /** 会话过期（BFF 401）时的登录引导 */
  onRequestLogin: () => void;
  /** 点击会员卡积分 → 切换到积分商城 */
  onNavigateMall: () => void;
}

export function VipPanel({ onRequestLogin, onNavigateMall }: VipPanelProps) {
  const [vipData, setVipData] = useState<VIPData | null>(null);
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [skinTestUsage, setSkinTestUsage] = useState<SkinTestUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<VipView>("main");
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [showChannelTip, setShowChannelTip] = useState(false);
  // 消费补录面板：首次进入后常驻挂载（hidden 切换可见性），保留表单草稿与已传凭证
  const [spentMounted, setSpentMounted] = useState(false);
  // 主视图退出动画完成后才显示补录面板，保持「先出后进」、避免两版叠加
  const [spentRevealed, setSpentRevealed] = useState(false);
  // 权益卡内部滚动状态：溢出且未滚到底时显示底部渐隐遮罩
  const [benefitsScroll, setBenefitsScroll] = useState({ overflowing: false, atBottom: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const benefitsScrollRef = useRef<HTMLDivElement>(null);
  const { error: showError } = useToast();
  const { user, refresh } = useAuth();

  const updateBenefitsScroll = useCallback(() => {
    const el = benefitsScrollRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight - el.clientHeight > 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setBenefitsScroll((prev) =>
      prev.overflowing === overflowing && prev.atBottom === atBottom
        ? prev
        : { overflowing, atBottom }
    );
  }, []);

  // 尺寸变化来源：右栏高度变化 / 视口缩放 / 字体加载（ResizeObserver），数据到达后重测
  useEffect(() => {
    updateBenefitsScroll();
    const measure = () => updateBenefitsScroll();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (benefitsScrollRef.current) observer?.observe(benefitsScrollRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [updateBenefitsScroll, vipData, loading]);

  const loadVIPData = useCallback(async () => {
    try {
      const res = await fetch("/api/account/membership");
      const data = (await res.json().catch(() => null)) as
        | (VIPData & { error?: { code?: string } })
        | null;
      const errorCode = data?.error?.code;
      // 会话失效 / scope 缺失（旧 token 未含 membership）：统一走登录引导
      if (
        res.status === 401 ||
        (!res.ok && (errorCode === "UNAUTHORIZED" || errorCode === "INSUFFICIENT_SCOPE"))
      ) {
        showError("登录状态已更新，请重新登录");
        onRequestLogin();
        return;
      }
      if (!res.ok) throw new Error(`membership ${res.status}`);
      if (data?.membershipLevel) {
        setVipData(data);
        if (user && data.membershipLevel !== user.membershipLevel) {
          void refresh();
        }
      } else {
        showError("加载会员信息失败");
      }
    } catch {
      showError("加载会员信息失败");
    } finally {
      setLoading(false);
    }
  }, [showError, onRequestLogin, user, refresh]);

  const loadPointsData = useCallback(async () => {
    try {
      const res = await fetch("/api/account/points");
      if (!res.ok) return;
      const data = (await res.json()) as { available?: number | null } | null;
      if (typeof data?.available === "number") {
        setPointsData({ available: data.available });
      }
    } catch {
      // 积分加载失败静默（不影响会员卡片主信息展示）
    }
  }, []);

  // AI 测肤用量（/api/advisor/test-limit 的 usage 映射为面板结构）
  const loadSkinTestUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/advisor/test-limit");
      if (!res.ok) return;
      const data = (await res.json()) as {
        level?: string | null;
        usage?: {
          totalUsed?: number;
          todayUsed?: number;
          lifetimeLimit?: number | null;
          dailyLimit?: number | null;
          unlimited?: boolean;
        } | null;
      } | null;
      const usage = data?.usage;
      if (!usage) return;
      const totalUsed = usage.totalUsed ?? 0;
      setSkinTestUsage({
        level: typeof data?.level === "string" ? data.level : null,
        totalUsed,
        todayUsed: usage.todayUsed ?? 0,
        quota: {
          lifetimeLimit: usage.lifetimeLimit ?? null,
          dailyLimit: usage.dailyLimit ?? null,
          unlimited: Boolean(usage.unlimited),
        },
        remaining:
          usage.lifetimeLimit != null ? Math.max(0, usage.lifetimeLimit - totalUsed) : null,
      });
    } catch {
      // 用量加载失败静默：卡片显示「测肤用量暂不可用」
    }
  }, []);

  useEffect(() => {
    void loadVIPData();
    void loadPointsData();
    void loadSkinTestUsage();
  }, [loadVIPData, loadPointsData, loadSkinTestUsage]);

  // 打卡实际到账积分后（POINTS_CHANGED_EVENT）静默刷新余额，保持与主站账本一致
  useEffect(() => {
    const onPointsChanged = () => void loadPointsData();
    window.addEventListener(POINTS_CHANGED_EVENT, onPointsChanged);
    return () => window.removeEventListener(POINTS_CHANGED_EVENT, onPointsChanged);
  }, [loadPointsData]);

  // 补录申请提交/刷新后：重拉会员卡与积分（审核通过后的等级/消费/积分变化即时体现）
  const handleApplicationsLoaded = useCallback(() => {
    void loadVIPData();
    void loadPointsData();
  }, [loadVIPData, loadPointsData]);

  // 视图切换时回到顶部：整版内容淡入淡出后高度变化，避免停留在旧滚动位置
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [view]);

  // 测肤用量不可用时的手动刷新
  const refreshSkinTestUsage = useCallback(async () => {
    setRefreshingUsage(true);
    try {
      await loadSkinTestUsage();
    } finally {
      setRefreshingUsage(false);
    }
  }, [loadSkinTestUsage]);

  // 问号切换官方渠道说明的防抖：交叉淡入淡出期间忽略重复点击，避免动画被打断闪烁
  const channelTipLockRef = useRef(false);
  const toggleChannelTip = useCallback(() => {
    if (channelTipLockRef.current) return;
    channelTipLockRef.current = true;
    setShowChannelTip((v) => !v);
    setTimeout(() => {
      channelTipLockRef.current = false;
    }, 400);
  }, []);

  // 消费补录面板可见性；挂载后 view 映射为面板内部视图（default 即隐藏态）
  const spentActive = view === "spent-form" || view === "spent-history";
  const spentVisible = spentActive && spentRevealed;
  const spentView: SpentPanelView =
    view === "spent-form" ? "form" : view === "spent-history" ? "history" : "default";

  if (!vipData && loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!vipData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-stone-400">暂无会员信息</p>
      </div>
    );
  }

  const { currentLevel, nextLevel, totalSpent, allLevels, memberId } = vipData;
  const tierStyle = TIER_CARD_STYLES[currentLevel.level] ?? TIER_CARD_STYLES.REGULAR;
  const cardBgImage = CARD_BG_IMAGES[currentLevel.level];

  /** 进入补录视图：从主视图/等级对比进入时需等退出动画完成再显示（onExitComplete 揭示） */
  const enterSpentView = (target: "spent-form" | "spent-history") => {
    setSpentMounted(true);
    if (!spentActive) setSpentRevealed(false);
    setView(target);
  };

  // 切换整版视图到消费补录表单/录入历史（与官网 VipPanel 一致）
  const focusSpentForm = () => enterSpentView("spent-form");

  const openSpentHistory = () => enterSpentView("spent-history");

  // 消费补录内部视图变化 → 整版视图映射
  const handleSpentViewChange = (v: SpentPanelView) => {
    if (v === "form") enterSpentView("spent-form");
    else if (v === "history") enterSpentView("spent-history");
    else setView("main");
  };

  return (
    <div className="flex h-full flex-col pt-4 md:pt-10" data-testid="panel-vip">
      {/* 标题 - 移动端由弹窗全局 Header 管理 */}
      <div className="hidden flex-shrink-0 border-b border-stone-200/60 px-6 pb-6 md:flex md:px-16">
        <h2 className="text-xl font-medium tracking-wide text-stone-800">会员中心</h2>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex-1 overflow-y-auto overscroll-contain px-6 py-6 md:px-16"
      >
        {/* 消费补录面板：首次进入后常驻挂载（hidden 切换可见性），
            避免返回主视图时卸载导致草稿与已传凭证丢失 */}
        {spentMounted && (
          <m.div
            key="spent"
            initial={{ opacity: 0 }}
            animate={{ opacity: spentVisible ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            hidden={!spentVisible}
          >
            <SpentAdjustmentPanel
              view={spentView}
              onViewChange={handleSpentViewChange}
              onApplicationsLoaded={handleApplicationsLoaded}
              onRequestLogin={onRequestLogin}
            />
          </m.div>
        )}

        {/* 主视图 / 等级对比：退出动画完成后（onExitComplete）才揭示补录面板 */}
        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={() => {
            // 回调取自最新一次渲染，闭包内 spentActive 即当前视图状态
            if (spentActive) setSpentRevealed(true);
          }}
        >
          {view === "main" && (
            <m.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* 两栏排版：左栏会员卡 + 会员权益，右栏提升引导卡（纵跨两行，含 AI 测肤）。
                  移动端按 会员卡 → 提升引导 → 会员权益 → AI 测肤 顺序堆叠（AI 卡 order-last）。 */}
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-[auto_1fr] lg:items-start">
                {/* 当前等级会员卡（标准卡片比例 85.6:53.98 ≈ 1.586:1，背景图按卡面铺满） */}
                <div
                  className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-xl border lg:col-start-1 lg:row-start-1 ${tierStyle.card}`}
                >
                  {cardBgImage && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${cardBgImage})` }}
                    />
                  )}

                  {/* 上半区文字底色：薄白纱保证可读性（图色仍然透出） */}
                  <div className="relative bg-white/25 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs tracking-wider text-stone-500">当前等级</p>
                        <h3 className="mt-1 text-xl font-medium text-stone-800">
                          {currentLevel.name}
                        </h3>
                        <p className="mt-1 text-[11px] font-light tracking-wider text-stone-500">
                          NO.{memberId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onNavigateMall}
                        className="text-right transition-opacity hover:opacity-70"
                      >
                        <p className="text-xs text-stone-500">我的积分</p>
                        <p className="mt-1 text-xl font-light text-stone-800">
                          {pointsData ? pointsData.available.toLocaleString() : "—"}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* 品牌 logo 常驻右下角，直接压在卡面背景图上 */}
                  <div className="relative mt-auto flex justify-end p-5">
                    <Image
                      src="/NIHPLOD-logo.svg"
                      alt="NIHPLOD"
                      width={130}
                      height={36}
                      className="w-[72px] object-contain"
                    />
                  </div>
                </div>

                {/* 右栏：提升引导卡（进度 + 如何提升 + 录入入口）与 AI 测肤用量卡 */}
                <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
                  <div className="rounded-xl border border-stone-200/60 bg-white/40 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-stone-700">
                      <TrendingUp className="h-[18px] w-[18px] text-[#00263e]" />
                      提升会员等级
                    </h4>

                    {nextLevel ? (
                      <div className="mt-3 rounded-xl border border-stone-200/60 bg-white/50 p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm text-stone-600">
                            再消费{" "}
                            <span className="text-base font-semibold leading-none text-[#00263e]">
                              ¥{nextLevel.spentNeeded.toLocaleString()}
                            </span>
                          </p>
                          <p className="shrink-0 text-xs text-stone-400">升级{nextLevel.name}</p>
                        </div>
                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-stone-200/70">
                          <div
                            className="h-full rounded-full bg-[#00263e]/80 transition-all duration-500"
                            style={{ width: `${nextLevel.progress}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-right text-xs text-stone-400">
                          {nextLevel.progress}%
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-relaxed text-stone-400">
                        您已是最高等级会员，全渠道消费记录可随时补录留存。
                      </p>
                    )}

                    {/* 如何提升会员等级：三步流程 + 录入消费 / 查看录入历史 */}
                    <div className="mt-6 border-t border-stone-300/70 pt-6">
                      <h5 className="flex items-center gap-2 text-sm font-medium text-stone-700">
                        <Info className="h-[18px] w-[18px] text-[#00263e]" />
                        如何提升会员等级
                      </h5>
                      {/* 步骤列表与官方渠道说明互斥交叉淡入淡出（问号图标切换，带点击防抖） */}
                      <div className="mt-3">
                        <AnimatePresence mode="wait" initial={false}>
                          {showChannelTip ? (
                            <m.div
                              key="channel-tip"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18 }}
                            >
                              <p className="text-xs leading-relaxed text-stone-400">
                                <button
                                  type="button"
                                  onClick={toggleChannelTip}
                                  aria-label="返回步骤说明"
                                  className="mr-1 inline-flex translate-y-[2px] text-[#00263e] transition-opacity hover:opacity-70"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                {CHANNEL_TIP_TEXT}
                              </p>
                            </m.div>
                          ) : (
                            <m.div
                              key="steps"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="space-y-2"
                            >
                              {[
                                "在官方渠道下单消费",
                                "签收成功后，复制订单编号",
                                "登录中国官网 > 会员中心录入消费 > 提交订单编号与凭证",
                              ].map((step, i) => (
                                <div key={i} className="flex items-baseline gap-2">
                                  <span className="shrink-0 text-xs text-stone-400">{i + 1}.</span>
                                  <p className="text-xs leading-relaxed text-stone-500">
                                    {step}
                                    {i === 0 && (
                                      <button
                                        type="button"
                                        onClick={toggleChannelTip}
                                        aria-label="查看官方渠道说明"
                                        aria-expanded={showChannelTip}
                                        className="relative ml-1 inline-flex translate-y-[2px] text-stone-400 transition-colors after:absolute after:-inset-2 after:content-[''] hover:text-[#00263e] active:opacity-60"
                                      >
                                        <CircleHelp className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </p>
                                </div>
                              ))}
                            </m.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={focusSpentForm}
                          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#00263e]/30 bg-white/40 px-5 py-2 text-xs text-[#00263e] transition-colors hover:border-[#00263e]/60 hover:bg-[#00263e]/5 active:opacity-70"
                        >
                          录入消费
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={openSpentHistory}
                          className="py-1.5 text-xs text-stone-500 transition-colors hover:text-stone-800 active:opacity-60"
                        >
                          查看录入历史
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI 测肤用量卡：不可用时弱提示 + 手动刷新 */}
                  <div className="order-last rounded-xl border border-stone-200/60 bg-white/40 p-5 lg:order-none">
                    <h5 className="flex items-center gap-2 text-sm font-medium text-stone-700">
                      <ScanFace className="h-[18px] w-[18px] text-[#00263e]" />
                      AI 测肤
                    </h5>
                    {!skinTestUsage ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <p className="text-xs leading-relaxed text-stone-400">测肤用量暂不可用</p>
                        <button
                          type="button"
                          onClick={() => void refreshSkinTestUsage()}
                          disabled={refreshingUsage}
                          aria-label="刷新测肤用量"
                          className="text-stone-400 transition-colors hover:text-stone-600 disabled:cursor-not-allowed"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${refreshingUsage ? "animate-spin" : ""}`}
                          />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {skinTestUsage.quota.unlimited ? (
                          <p className="text-sm text-stone-700">
                            AI 测肤 <span className="font-medium text-stone-800">不限次</span>
                          </p>
                        ) : (
                          <p className="text-sm text-stone-700">
                            已用{" "}
                            <span className="font-medium text-stone-800">
                              {skinTestUsage.totalUsed}
                            </span>
                            {" / 共 "}
                            {skinTestUsage.quota.lifetimeLimit} 次
                          </p>
                        )}
                        {skinTestUsage.quota.dailyLimit != null && (
                          <p className="text-xs text-stone-500">
                            今日已用 {skinTestUsage.todayUsed}/{skinTestUsage.quota.dailyLimit}
                          </p>
                        )}
                        {!skinTestUsage.quota.unlimited &&
                          skinTestUsage.remaining != null &&
                          skinTestUsage.remaining <= 0 && (
                            <div className="pt-1">
                              <p className="text-xs leading-relaxed text-stone-500">
                                {vipData.membershipLevel === "SILVER"
                                  ? "测肤次数已用完，升级金卡会员可享不限次 AI 测肤"
                                  : "测肤次数已用完，升级银卡会员可获更多测肤次数"}
                              </p>
                              <button
                                type="button"
                                onClick={focusSpentForm}
                                className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#00263e] px-4 py-2 text-xs text-white transition-colors hover:bg-[#0d3b5c] active:opacity-80"
                              >
                                了解会员升级
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 会员权益 - 直接展示当前等级权益；「全部等级」入口进入四档对比 */}
                <div className="flex flex-col lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:self-stretch lg:overflow-hidden lg:[contain:size]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-stone-700">
                      <Crown className="h-[18px] w-[18px] text-[#00263e]" />
                      会员权益
                    </h4>
                    <button
                      type="button"
                      onClick={() => setView("levels")}
                      className="inline-flex items-center gap-0.5 rounded-full border border-stone-200 bg-white/40 px-3.5 py-1.5 text-xs text-stone-500 transition-colors hover:border-stone-300 hover:bg-white/70 hover:text-stone-800 active:opacity-70"
                    >
                      全部等级
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <div
                      ref={benefitsScrollRef}
                      onScroll={updateBenefitsScroll}
                      className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200/60 bg-white/40 p-5"
                    >
                      {currentLevel.benefits.map((b, i) => {
                        const BenefitIcon = benefitIcon(b.title);
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <BenefitIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00263e]" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-800">{b.title}</p>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-stone-400 md:text-xs">
                                {b.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 内容溢出且未滚到底：底部由实到虚的渐隐遮罩 */}
                    <AnimatePresence>
                      {benefitsScroll.overflowing && !benefitsScroll.atBottom && (
                        <m.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          aria-hidden
                          data-testid="benefits-fade"
                          className="pointer-events-none absolute inset-x-px bottom-px h-8 rounded-b-[11px] bg-gradient-to-t from-[#FBF8F0] to-transparent"
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </m.div>
          )}

          {view === "levels" && (
            <m.div
              key="levels"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* 头部：标题 + 返回 */}
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-lg font-medium text-stone-800">等级权益对比</h4>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white/40 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-300 hover:bg-white/70 hover:text-stone-900"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  返回
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-400">
                会员等级按官方店铺累计消费实时判定，等级永久有效、可升可降。
              </p>

              {/* 四档权益一页式对比：当前最清晰，已解锁次之，未解锁去色淡化 */}
              <div className="mt-4 space-y-4">
                {allLevels.map((level) => {
                  const isCurrent = level.level === currentLevel.level;
                  const isUnlocked = !isCurrent && level.minSpent <= totalSpent;
                  const isLocked = !isCurrent && !isUnlocked;
                  const tierBgImage = CARD_BG_IMAGES[level.level];
                  // 距该等级的累计消费进度（未达档 0–99%，用等级自身色系的进度条区分）
                  const tierProgress =
                    level.minSpent > 0
                      ? Math.min(100, Math.round((totalSpent / level.minSpent) * 100))
                      : 100;
                  return (
                    <div
                      key={level.level}
                      className={`relative overflow-hidden rounded-xl border ${
                        isCurrent
                          ? "border-[#00263e] bg-white/70"
                          : isUnlocked
                            ? "border-stone-200/60 bg-white/50"
                            : "border-stone-200/50 bg-white/40"
                      }`}
                    >
                      {tierBgImage && (
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute inset-0 bg-cover bg-center ${
                            isCurrent
                              ? "opacity-25 blur-[2px]"
                              : isUnlocked
                                ? "opacity-15 blur-sm"
                                : "opacity-[0.08] blur-sm grayscale"
                          }`}
                          style={{ backgroundImage: `url(${tierBgImage})` }}
                        />
                      )}
                      <div className="relative p-5">
                        {/* 等级名 + 状态徽标 + 门槛 */}
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                          <div className="flex items-center gap-2">
                            <p
                              className={`text-base font-medium ${
                                isCurrent
                                  ? "text-stone-900"
                                  : isUnlocked
                                    ? "text-stone-700"
                                    : "text-stone-400"
                              }`}
                            >
                              {level.name}
                            </p>
                            {isCurrent ? (
                              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#00263e]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#00263e]">
                                <Crown className="h-3 w-3" />
                                当前
                              </span>
                            ) : isUnlocked ? (
                              <span className="flex shrink-0 items-center gap-1 rounded-full border border-stone-200/80 bg-white/60 px-2.5 py-0.5 text-[11px] text-stone-500">
                                <Check className="h-3 w-3 text-[#00263e]" />
                                已解锁
                              </span>
                            ) : (
                              <span className="flex shrink-0 items-center gap-1 rounded-full border border-stone-200/60 bg-white/40 px-2.5 py-0.5 text-[11px] text-stone-400">
                                <Lock className="h-3 w-3" />
                                未解锁
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400">
                            {level.minSpent > 0
                              ? `消费满 ¥${level.minSpent.toLocaleString()}`
                              : "注册即享"}
                          </p>
                        </div>

                        {/* 权益列表：适配图标 + 标题 + 描述；宽卡片两列（窄屏单列） */}
                        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-stone-200/60 pt-4 md:grid-cols-2">
                          {level.benefits.map((b, i) => {
                            const BenefitIcon = benefitIcon(b.title);
                            return (
                              <div key={i} className="flex items-start gap-2.5">
                                <BenefitIcon
                                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                                    isLocked ? "text-stone-400" : "text-[#00263e]"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      isLocked ? "text-stone-500" : "text-stone-800"
                                    }`}
                                  >
                                    {b.title}
                                  </p>
                                  <p className="mt-0.5 text-[13px] leading-relaxed text-stone-400 md:text-xs">
                                    {b.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 未达档等级：解锁进度 + 补录引导（直达录入表单） */}
                        {isLocked && (
                          <div className="-mx-5 -mb-5 mt-4 border-t border-stone-200/60 bg-stone-500/[0.04] px-5 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="flex min-w-0 items-center gap-1.5 text-xs text-stone-600">
                                <Lock className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                                <span>
                                  还差{" "}
                                  <span className="text-sm font-medium text-[#00263e]">
                                    ¥{(level.minSpent - totalSpent).toLocaleString()}
                                  </span>{" "}
                                  解锁该等级
                                </span>
                              </p>
                              <button
                                type="button"
                                onClick={focusSpentForm}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00263e] px-4 py-2 text-xs text-white transition-colors hover:bg-[#0d3b5c] active:opacity-80"
                              >
                                补录消费记录
                              </button>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200/70">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    TIER_CARD_STYLES[level.level]?.bar ?? "bg-[#00263e]/80"
                                  }`}
                                  style={{ width: `${tierProgress}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-[11px] text-stone-400">
                                {tierProgress}%
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 当前为普通档：升级引导（解锁银卡全部权益） */}
                        {isCurrent && level.level === "REGULAR" && (
                          <div className="-mx-5 -mb-5 mt-4 border-t border-stone-200/60 bg-stone-500/[0.04] px-5 py-4">
                            <div className="flex items-start gap-2">
                              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                              <p className="text-xs leading-relaxed text-stone-600">
                                累计消费满 ¥1,000 升级银卡会员，解锁档案保留、AI
                                顾问、积分兑礼与生日礼遇等权益
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={focusSpentForm}
                              className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#00263e] px-4 py-2 text-xs text-white transition-colors hover:bg-[#0d3b5c] active:opacity-80"
                            >
                              补录消费记录
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </m.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
