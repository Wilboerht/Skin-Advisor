

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Fragment } from 'react';
// 引入完整分析内容的复用组件（假设已抽出为可复用组件）
import { FullAnalysisSection } from '@/components/advisor/FullAnalysisSection';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Lock, Loader2 } from 'lucide-react';
import { FloatingToolbar } from '@/components/advisor/FloatingToolbar';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthModal } from '@/components/auth/AuthModalContext';
import { useToast } from '@/components/ui/Toast';

interface Dimension {
  score?: number;
  percentile?: number;
}

interface ShareLandingProps {
  data: {
    score: number;
    skinAge: number;
    dimensions: {
      skin_condition?: Dimension;
      wrinkles?: Dimension;
      texture?: Dimension;
      waterOil: Dimension;
      [key: string]: Dimension | undefined;
    };
    nickname: string;
    generatedAvatar?: string;
    sessionId: string;
    guestAnalysis?: {
      summary?: string;
    };
    // 新增，兼容详细分析区块
    result: any;
    faceAnalysis: any;
  };
}

const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = value / (duration * 1000 / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(Math.round(value));
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {displayValue}
    </motion.span>
  );
};

export default function ShareLandingClient({ data }: ShareLandingProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openAuthModal } = useAuthModal();
  const toast = useToast();
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(data.generatedAvatar || null);
  const [isAvatarLoading, setIsAvatarLoading] = useState(!data.generatedAvatar);
  const [avatarQueueStatus, setAvatarQueueStatus] = useState<{
    position?: number;
    estimatedWaitTime?: number;
    message?: string;
  } | null>(null);

  // 登录用户跳转到完整报告页
  useEffect(() => {
    if (!loading && user) {
      router.replace(`/result?id=${data.sessionId}`);
    }
  }, [loading, user, router, data.sessionId]);

  // --- Avatar Polling ---
  // 游客分享页也可能头像未生成完，添加轮询
  useEffect(() => {
    const sessionId = data.sessionId;
    if (!sessionId || generatedAvatar || !isAvatarLoading) return;

    const pollRef = { failureCount: 0 };

    const pollAvatar = async () => {
      try {
        const response = await fetch(`/api/advisor/avatar/status?sessionId=${sessionId}&t=${Date.now()}`);
        if (response.ok) {
          const resData = await response.json();

          if (resData.queueStatus && resData.queueStatus !== 'completed') {
            setAvatarQueueStatus({
              position: resData.queuePosition,
              estimatedWaitTime: resData.estimatedWaitTime,
              message: resData.message,
            });
          }

          if (resData.generatedAvatar && typeof resData.generatedAvatar === 'string' &&
              (resData.generatedAvatar.startsWith('http') || resData.generatedAvatar.startsWith('data:'))) {
            setGeneratedAvatar(resData.generatedAvatar);
            setIsAvatarLoading(false);
            setAvatarQueueStatus(null);
            return;
          }
          pollRef.failureCount = 0;
        } else if (response.status === 404) {
          pollRef.failureCount = 999;
        } else {
          pollRef.failureCount++;
        }
      } catch (err) {
        pollRef.failureCount++;
      }

      if (pollRef.failureCount >= 5) {
        setIsAvatarLoading(false);
      }
    };

    const interval = setInterval(pollAvatar, avatarQueueStatus ? 1000 : 500);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (isAvatarLoading) {
        setIsAvatarLoading(false);
        setAvatarQueueStatus(null);
      }
    }, 120000);

    pollAvatar();

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [data.sessionId, generatedAvatar, isAvatarLoading, avatarQueueStatus]);

  // percentile 取最大值
  const rankPercentile = useMemo(() => {
    const percentiles = Object.values(data.dimensions)
      .filter((dim): dim is Dimension => dim !== undefined && dim.percentile !== undefined)
      .map((dim) => dim.percentile as number);
    return percentiles.length > 0 ? Math.max(...percentiles) : 96;
  }, [data.dimensions]);

  // T区标签
  const getTZoneLabel = useMemo(() => {
    const score = data.dimensions.waterOil?.score ?? 0;
    if (score >= 80) return 'T区平衡';
    if (score >= 60) return 'T区略油';
    return 'T区偏油';
  }, [data.dimensions.waterOil?.score]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: '皮肤检测结果',
          text: `我的皮肤综合评分是 ${data.score}，超越了全国 ${rankPercentile}% 的用户`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('分享链接已复制到剪贴板');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error('分享失败，请重试');
      }
    }
    setShowShareModal(false);
  };

  return (
    <div className="min-h-screen font-sans text-[#7a6552] flex flex-col relative overflow-x-hidden">
      {/* Fixed Background Layer - Optimized for iOS and dynamic viewports */}
      <div
        className="fixed top-0 left-0 w-full h-[100dvh] z-[-1] pointer-events-none"
        style={{
          backgroundImage: 'url(/images/result-bg.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: 'translateZ(0)', // Force hardware acceleration
          WebkitTransform: 'translateZ(0)',
        }}
      />

      {/* Header hidden or customized per design */}
      <div className="flex-1 py-12 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center w-full relative z-10">
        <img
          src="/images/NIHPLOD-logo.svg"
          alt="NIHPLOD MONACO"
          className="h-8 sm:h-10 mb-8 object-contain"
        />

        <div className="w-full flex flex-col gap-6">
          {/* Share Version Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-[32px] p-6 lg:p-10"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 248, 235, 0.95) 0%, rgba(245, 230, 205, 0.9) 100%)',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), inset 0 2px 0 rgba(255,255,255,0.7)',
            }}
          >
            <div className="flex flex-row-reverse lg:flex-row items-start gap-4 lg:gap-10 relative z-10 w-full">

              {/* Left Column: Tag + Avatar properly aligned */}
              <div className="flex flex-col items-end lg:items-start gap-4 shrink-0">
                {/* Tag - Hidden on Mobile, Shown on PC */}
                <div className="hidden lg:flex relative items-center justify-center w-[72px] h-[24px]">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm" />
                  <div className="absolute inset-[1px] rounded-lg bg-white/20 backdrop-blur-[1px] border border-white/30" />
                  <span className="relative z-10 text-[#3d2f25] text-xs font-bold tracking-widest">
                    分享版
                  </span>
                </div>

                {/* Avatar with Ring */}
                <div className="relative flex items-center justify-center w-[92px] h-[92px]">
                  {/* Subtle Gradient Matte Gold Ring */}
                  <div className="absolute inset-0 rounded-full p-[2.5px] bg-gradient-to-br from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm">
                    {/* Ultra-Thin White Gap */}
                    <div className="w-full h-full rounded-full bg-white p-[1px]">
                      {/* Inner Avatar Content */}
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#f8f0e3] to-[#f5dfb8]">
                        {isAvatarLoading ? (
                          <Loader2 className="w-6 h-6 text-[#c4b5a2] animate-spin" />
                        ) : (
                          <motion.img
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            src={generatedAvatar || "/user-placeholder.svg"}
                            alt="avatar"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/user-placeholder.svg";
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Minimal name badge */}
                  <div className="absolute -bottom-0.5 -right-0.5 bg-[#2d2a26] text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap z-20 border-[1.5px] border-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                    {data.nickname}
                  </div>
                </div>
              </div>

              <div className="flex flex-col z-10 flex-1 pt-[2px]">
                {/* Tag - Shown on Mobile, Hidden on PC */}
                <div className="flex lg:hidden relative items-center justify-center w-[72px] h-[24px] mb-6">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm" />
                  <div className="absolute inset-[1px] rounded-lg bg-white/20 backdrop-blur-[1px] border border-white/30" />
                  <span className="relative z-10 text-[#3d2f25] text-xs font-bold tracking-widest">
                    分享版
                  </span>
                </div>
                {/* 保证这里的高度(24px)与底部间距(mb-4=16px)加起来等于左侧标签高度(24px)+gap-4(16px) = 40px */}
                <div className="hidden lg:flex h-[24px] items-center mb-6">
                  <p className="text-[#a89582] text-sm leading-none">亲爱的「{data.nickname}」 ：</p>
                </div>
                <h2 className="text-xl lg:text-3xl font-bold text-[#2d2a26] leading-snug tracking-tight lg:tracking-normal mb-5 lg:mb-4 mt-0">
                  你的素颜评分超越了<br />
                  全国 <span className="text-2xl lg:text-4xl px-0.5">{rankPercentile}%</span> 的用户
                </h2>
                <p className="text-[#8c7a6b] text-xs lg:text-sm leading-relaxed tracking-tight lg:tracking-normal max-w-[75%] lg:max-w-sm mb-6">
                  {data.guestAnalysis?.summary || "整体状态极佳，肌肤屏障健康，水油平衡度完美，仅在眼周区域存在轻微色素沉积。"}
                </p>

                {/* Share Button & Handwritten note */}
                <div className="flex items-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowShareModal(true)}
                    className="relative focus:outline-none flex items-center justify-center h-[34px] sm:h-[42px] px-5 sm:px-8 rounded-full shadow-[0_4px_12px_-3px_rgba(150,110,60,0.18)] border border-[#e6d0a8]/50 group transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #fdf6e9 0%, #f5dfb8 50%, #e6d0a8 100%)',
                    }}
                  >
                    {/* Inner Shine Effect */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/30 pointer-events-none" />
                    <div className="absolute inset-[1px] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] pointer-events-none" />

                    <span className="relative z-10 text-[#5e4b3c] text-xs sm:text-[12px] font-bold flex items-center justify-center gap-2 tracking-wide">
                      <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#7a6552] stroke-[2.5]" />
                      分享我的素颜证书
                    </span>
                  </motion.button>
                  <div className="hidden sm:flex items-center -ml-[10px] z-10">
                    <img
                      src="/images/share-hint.svg"
                      alt="分享提示"
                      className="h-[58px] w-auto object-contain -mt-2"
                    />
                  </div>
                </div>

                {/* Mobile Hint */}
                <div className="flex sm:hidden items-center ml-0 mt-1 opacity-90">
                  <img
                    src="/images/mobile-share-hint.svg"
                    alt="分享提示"
                    className="h-[42px] w-auto object-contain"
                  />
                </div>
              </div>

              {/* Decorative Image Area (Right) */}
              <div className="absolute right-[-80px] lg:-right-33 bottom-[108px] lg:-bottom-6 w-1/2 h-[110%] pointer-events-none flex items-end justify-end z-20">
                {/* Gift Box sitting on the ribbon */}
                <div
                  className="absolute -bottom-[53%] lg:-bottom-[30%] w-[16rem] sm:w-[28rem] h-[16rem] sm:h-[28rem] z-30 drop-shadow-2xl right-[-55px] lg:right-[-48px]"
                >
                  <img
                    src="/images/gift.svg"
                    alt="礼盒"
                    className="w-full h-full object-contain"
                  />
                </div>
                <img
                  src="/images/ribbon.svg"
                  alt="装饰彩带"
                  className="w-full h-full object-contain object-right-bottom opacity-90 scale-[1.8] lg:scale-110"
                />
              </div>
            </div>
          </motion.div>

          {/* Professional Version Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[32px] p-6 lg:p-10 backdrop-blur-xl border border-white/20 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(230, 215, 195, 0.4) 0%, rgba(200, 180, 155, 0.3) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <div className="flex flex-row lg:flex-row justify-between items-stretch lg:items-center gap-4 lg:gap-12 h-full">
              {/* Refined Split Layout - 52% width on mobile */}
              <div className="flex flex-col justify-between items-start w-[52%] lg:w-[30%] shrink-0">
                <div>
                  <div className="bg-white/80 text-[#5c4937] w-[72px] lg:w-[72px] h-[24px] lg:h-[24px] rounded-lg text-xs lg:text-xs font-bold flex items-center justify-center mb-6 lg:mb-6 shadow-sm border border-white/50 tracking-widest relative z-10">
                    专业版
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-white drop-shadow-md mb-2 relative z-10">
                    深度<br className="lg:hidden" />肌肤检测报告
                  </h2>
                  <p className="text-white text-xs lg:text-xs max-w-xs leading-relaxed mb-6 lg:mb-8 font-medium tracking-wide relative z-10">
                    基于千万级亚洲肌肤数据库，<br className="lg:hidden" />全方位解析您的肌肤问题。
                  </p>
                </div>

                {!user && (
                  <motion.button
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openAuthModal('register')}
                    className="relative focus:outline-none flex items-center justify-center h-[34px] lg:h-[42px] px-5 lg:px-8 rounded-full shadow-[0_8px_20px_-6px_rgba(0,0,0,0.15)] border border-white/60 group overflow-hidden transition-all mt-auto lg:mt-0"
                    style={{
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f0e3 50%, #f0e6d8 100%)',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                    <span className="relative z-10 text-[#5c4937] text-xs lg:text-[12px] font-bold tracking-wider flex items-center justify-center gap-2 whitespace-nowrap">
                      登录查看完整报告
                      <Lock className="w-3 h-3 text-[#5c4937] stroke-[2.5] shrink-0" />
                    </span>
                  </motion.button>
                )}
              </div>

              {/* Right Cards Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-4 flex-1 max-w-[170px] mx-auto lg:max-w-none">
                {/* Comprehensive Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] relative min-h-[48px] lg:min-h-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(230,220,205,0.7) 0%, rgba(240,230,215,0.5) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  {/* PC Decor Glow */}
                  <div className="hidden lg:block absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-500/70 blur-[25px] rounded-full" />
                  </div>
                  <img src="/images/vector-decor.svg" alt="" className="block absolute -top-3 -right-3 lg:-top-4 lg:-right-5 w-10 h-10 lg:w-16 lg:h-16 z-30 pointer-events-none" />
                  <img src="/images/vector-decor.svg" alt="" className="block lg:hidden absolute -top-3 right-9 lg:-top-4 lg:right-16 w-6 h-6 lg:w-10 lg:h-10 z-30 pointer-events-none scale-x-[-1]" />
                  <img src="/images/vector-decor.svg" alt="" className="hidden lg:block absolute top-10 -right-4 w-7 h-7 z-10 pointer-events-none" />
                  <img src="/images/vector-decor.svg" alt="" className="block absolute -bottom-2 -left-3 lg:-bottom-5 lg:-left-5 w-8 h-8 lg:w-12 lg:h-12 z-10 pointer-events-none opacity-80" />

                  <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                    <p className="text-[11px] lg:text-xs text-[#7a6552] font-medium shrink-0">综合评分</p>
                    <div className="flex items-baseline">
                      <span className="text-[11px] lg:text-3xl font-bold text-[#5c4937] leading-none">
                        <AnimatedNumber value={data.score} duration={1.5} />
                      </span>
                      <span className="text-[11px] lg:text-xs text-[#7a6552] ml-0.5 font-medium">分</span>
                    </div>
                  </div>
                </motion.div>

                {/* Skin Age */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                  className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(240,225,215,0.8) 0%, rgba(255,245,230,0.6) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                >
                  <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                    <p className="text-[12px] lg:text-xs text-[#7a6552] font-medium shrink-0">肌肤年龄</p>
                    <div className="flex items-baseline">
                      <span className="text-[13px] lg:text-3xl font-bold text-[#5c4937] leading-none">
                        <AnimatedNumber value={data.skinAge} duration={1.5} />
                      </span>
                      <span className="text-[12px] lg:text-xs text-[#7a6552] ml-0.5 font-medium">岁</span>
                    </div>
                  </div>
                </motion.div>

                {/* T-zone Indicator */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(230,225,215,0.6) 0%, rgba(245,240,230,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                  }}
                >
                  <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                    <p className="text-[11px] lg:text-xs text-[#7a6552] font-medium shrink-0">油脂分泌</p>
                    <div className="flex items-baseline">
                      <span className="text-[11px] lg:text-xl font-bold text-[#5c4937] leading-tight">{getTZoneLabel}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Last slot: Login Unlock or Extra data */}
                {!user ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.15)' }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => openAuthModal('register')}
                    className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-center lg:justify-center lg:gap-3 lg:aspect-[2/3] border border-dashed border-white/50 cursor-pointer group transition-colors min-h-[48px] lg:min-h-0"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    <div className="flex lg:flex-col items-center gap-2">
                      <div className="w-5 h-5 lg:w-8 lg:h-8 rounded-lg bg-white/80 flex items-center justify-center shadow-sm group-hover:bg-white transition-colors">
                        <Lock className="w-3 h-3 lg:w-4 lg:h-4 text-[#8c7a6b]" />
                      </div>
                      <p className="text-[#5c4937] text-[11px] lg:hidden font-medium">更多数据待解锁</p>
                    </div>
                    <p className="hidden lg:block text-[#5c4937] text-xs font-medium text-center">登录</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-3 lg:p-4 rounded-xl lg:rounded-2xl flex flex-row lg:flex-col items-center lg:items-start justify-between lg:aspect-[2/3] min-h-[48px] lg:min-h-0 relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(180deg, rgba(230,225,215,0.6) 0%, rgba(245,240,230,0.4) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                    }}
                  >
                    <div className="flex flex-row lg:flex-col items-center lg:items-start gap-2 lg:justify-between w-full h-full relative z-20">
                      <p className="text-[12px] lg:text-xs text-[#7a6552] font-medium shrink-0">详情</p>
                      <div className="flex items-center">
                        <span className="text-[13px] lg:text-xl font-bold text-[#5c4937]">已解锁</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        <p className="text-center text-[#a89582] text-xs mt-6 tracking-widest">AI综合分析结果</p>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/20"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white/80 backdrop-blur-2xl rounded-[32px] pt-12 pb-8 px-8 max-w-[340px] w-full border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden"
            >
              {/* Background Decor */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#e6d0a8]/20 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Floating Logo */}
                <div className="mb-6">
                  <img
                    src="/images/NIHPLOD-logo.svg"
                    alt="Logo"
                    className="h-6 w-auto object-contain brightness-95 opacity-80"
                  />
                </div>

                <h3 className="text-xl font-bold text-[#2d2a26] mb-2 tracking-tight">分享我的检测结果</h3>
                <p className="text-sm text-[#8c7a6b] mb-8 leading-relaxed">
                  让好友见证您的肌肤蜕变<br />同步解锁专属护肤建议
                </p>

                <div className="w-full space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShare}
                    className="relative w-full py-3.5 px-6 rounded-full shadow-[0_4px_12px_-2px_rgba(150,110,60,0.2)] border border-[#e6d0a8]/50 group transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #fdf6e9 0%, #f5dfb8 50%, #e6d0a8 100%)',
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/30 pointer-events-none" />
                    <span className="relative z-10 text-[#5e4b3c] text-sm font-bold flex items-center justify-center gap-2 tracking-wide">
                      复制分享链接
                    </span>
                  </motion.button>

                  <motion.button
                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowShareModal(false)}
                    className="w-full py-3 text-sm font-medium text-[#c4b5a2] hover:text-[#8c7a6b] transition-colors"
                  >
                    再等一下
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toolbar */}
      <FloatingToolbar
        onSharePoster={() => {
          setShowShareModal(true);
        }}
        onRetake={() => router.push("/questions")}
        onChat={() => {
          /* TODO: 打开 AI 咨询 */
        }}
      />
    </div>
  );
}
