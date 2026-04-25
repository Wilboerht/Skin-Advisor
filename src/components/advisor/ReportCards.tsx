'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Lock, Loader2 } from 'lucide-react';
import { SharePoster } from '@/components/advisor/poster/SharePoster';
import html2canvas from 'html2canvas';

interface Dimension {
  score?: number;
  percentile?: number;
}

interface ReportCardsProps {
  score: number;
  skinAge: number;
  dimensions: Record<string, Dimension | undefined>;
  nickname: string;
  generatedAvatar?: string | null;
  isAvatarLoading?: boolean;
  summary?: string;
  onShare: () => void;
  isLoggedIn: boolean;
  onLoginClick?: () => void;
  onUnlockClick?: () => void;
  professionalClassName?: string;
  professionalStyle?: React.CSSProperties;
  comprehensiveReport?: React.ReactNode;
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

export default function ReportCards({
  score,
  skinAge,
  dimensions,
  nickname,
  generatedAvatar,
  isAvatarLoading,
  summary,
  onShare,
  isLoggedIn,
  onLoginClick,
  onUnlockClick,
  professionalClassName,
  professionalStyle,
  comprehensiveReport,
}: ReportCardsProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const currentAvatar = generatedAvatar || null;

  const rankPercentile = useMemo(() => {
    const percentiles = Object.values(dimensions)
      .filter((dim): dim is Dimension => dim !== undefined && dim.percentile !== undefined)
      .map((dim) => dim.percentile as number);
    return percentiles.length > 0 ? Math.max(...percentiles) : 96;
  }, [dimensions]);

  const getTZoneLabel = useMemo(() => {
    const waterOil = dimensions?.waterOil;
    const s = waterOil?.score ?? 0;
    if (s >= 80) return 'T区平衡';
    if (s >= 60) return 'T区略油';
    return 'T区偏油';
  }, [dimensions]);

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleSavePoster = async () => {
    if (!posterRef.current || isGeneratingPoster) return;

    try {
      setIsGeneratingPoster(true);

      // 等待图片加载
      const images = Array.from(posterRef.current.getElementsByTagName('img'));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: null,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `NIHPLOD-肌肤报告-${nickname}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('海报生成失败:', error);
    } finally {
      setIsGeneratingPoster(false);
    }
    setShowShareModal(false);
  };

  return (
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
          {/* Left Column: Tag + Avatar */}
          <div className="flex flex-col items-end lg:items-start gap-4 shrink-0">
            <div className="hidden lg:flex relative items-center justify-center w-[72px] h-[24px]">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm" />
              <div className="absolute inset-[1px] rounded-lg bg-white/20 backdrop-blur-[1px] border border-white/30" />
              <span className="relative z-10 text-[#3d2f25] text-xs font-bold tracking-widest">分享版</span>
            </div>

            {/* Avatar with Ring */}
            <div className="relative flex items-center justify-center w-[92px] h-[92px]">
              <div className="absolute inset-0 rounded-full p-[2.5px] bg-gradient-to-br from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm">
                <div className="w-full h-full rounded-full bg-white p-[1px]">
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#f8f0e3] to-[#f5dfb8]">
                    {isAvatarLoading ? (
                      <Loader2 className="w-6 h-6 text-[#c4b5a2] animate-spin" />
                    ) : (
                      <motion.img
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={currentAvatar || '/user-placeholder.svg'}
                        alt="avatar"
                        className="w-full h-full object-cover object-top"
                        onLoad={() => console.log("[DEBUG] ReportCards avatar image loaded, src:", currentAvatar ? currentAvatar.substring(0, 60) + "..." : "placeholder")}
                        onError={(e) => {
                          console.error("[DEBUG] ReportCards avatar image failed to load, src:", (e.target as HTMLImageElement).src);
                          (e.target as HTMLImageElement).src = '/user-placeholder.svg';
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 bg-[#2d2a26] text-white text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap z-20 border-[1.5px] border-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                {nickname}
              </div>
            </div>
          </div>

          <div className="flex flex-col z-10 flex-1 pt-[2px]">
            {/* Mobile Tag */}
            <div className="flex lg:hidden relative items-center justify-center w-[72px] h-[24px] mb-6">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#e6d0a8] via-[#f5dfb8] to-[#d4b483] shadow-sm" />
              <div className="absolute inset-[1px] rounded-lg bg-white/20 backdrop-blur-[1px] border border-white/30" />
              <span className="relative z-10 text-[#3d2f25] text-xs font-bold tracking-widest">分享版</span>
            </div>

            <div className="hidden lg:flex h-[24px] items-center mb-6">
              <p className="text-[#a89582] text-sm leading-none">亲爱的「{nickname}」 ：</p>
            </div>

            <h2 className="text-xl lg:text-3xl font-bold text-[#2d2a26] leading-snug tracking-tight lg:tracking-normal mb-5 lg:mb-4 mt-0">
              你的素颜评分超越了<br />
              全国 <span className="text-2xl lg:text-4xl px-0.5">{rankPercentile}%</span> 的用户
            </h2>

            <p className="text-[#8c7a6b] text-xs lg:text-sm leading-relaxed tracking-tight lg:tracking-normal max-w-[75%] lg:max-w-sm mb-6">
              {summary || '整体状态极佳，肌肤屏障健康，水油平衡度完美，仅在眼周区域存在轻微色素沉积。'}
            </p>

            {/* Share Button */}
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleShareClick}
                className="relative focus:outline-none flex items-center justify-center h-[34px] sm:h-[42px] px-5 sm:px-8 rounded-full shadow-[0_4px_12px_-3px_rgba(150,110,60,0.18)] border border-[#e6d0a8]/50 group transition-all"
                style={{
                  background: 'linear-gradient(135deg, #fdf6e9 0%, #f5dfb8 50%, #e6d0a8 100%)',
                }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/30 pointer-events-none" />
                <div className="absolute inset-[1px] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] pointer-events-none" />
                <span className="relative z-10 text-[#5e4b3c] text-xs sm:text-[12px] font-bold flex items-center justify-center gap-2 tracking-wide">
                  <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#7a6552] stroke-[2.5]" />
                  分享我的素颜证书
                </span>
              </motion.button>

              <div className="hidden sm:flex items-center -ml-[10px] z-10">
                <img src="/images/share-hint.svg" alt="分享提示" className="h-[58px] w-auto object-contain -mt-2" />
              </div>
            </div>

            <div className="flex sm:hidden items-center ml-0 mt-1 opacity-90">
              <img src="/images/mobile-share-hint.svg" alt="分享提示" className="h-[42px] w-auto object-contain" />
            </div>
          </div>

          {/* Decorative Image Area (Right) */}
          <div className="absolute right-[-80px] lg:-right-33 bottom-[108px] lg:-bottom-6 w-1/2 h-[110%] pointer-events-none flex items-end justify-end z-20">
            <div className="absolute -bottom-[53%] lg:-bottom-[30%] w-[16rem] sm:w-[28rem] h-[16rem] sm:h-[28rem] z-30 drop-shadow-2xl right-[-55px] lg:right-[-48px]">
              <img src="/images/gift.svg" alt="礼盒" className="w-full h-full object-contain" />
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
        className={`relative rounded-[32px] p-6 lg:p-10 backdrop-blur-xl border border-white/20 overflow-hidden ${professionalClassName || ''}`}
        style={{
          background: 'linear-gradient(135deg, rgba(230, 215, 195, 0.4) 0%, rgba(200, 180, 155, 0.3) 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.3)',
          ...professionalStyle,
        }}
      >
        <div className="flex flex-row lg:flex-row justify-between items-stretch lg:items-center gap-4 lg:gap-12 h-full">
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

            {!isLoggedIn && onLoginClick && (
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onLoginClick}
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
                    <AnimatedNumber value={score} duration={1.5} />
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
                    <AnimatedNumber value={skinAge} duration={1.5} />
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

            {/* Last slot: Login Unlock or Unlocked */}
            {!isLoggedIn ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.15)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ delay: 0.4 }}
                onClick={onLoginClick}
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
              <div
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
              </div>
            )}
          </div>
        </div>
        {comprehensiveReport}
      </motion.div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] backdrop-blur-sm bg-black/20"
              onClick={() => setShowShareModal(false)}
            />

            {/* 弹窗 - 左右结构 */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[640px]"
            >
              <div className="relative bg-white/80 backdrop-blur-2xl rounded-[32px] p-8 lg:p-10 border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#e6d0a8]/20 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />

                {/* 顶部 Logo */}
                <div className="relative z-10 flex flex-col items-center mb-6">
                  <img
                    src="/images/NIHPLOD-logo.svg"
                    alt="Logo"
                    className="h-7 w-auto object-contain brightness-95 opacity-80 mb-4"
                  />
                  {/* 两端虚化分割线 */}
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4b483]/40 to-transparent" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-8 md:gap-10">
                  {/* 左侧：文字和操作 */}
                  <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 min-w-0 justify-center">
                    <h3 className="text-lg font-bold text-[#2d2a26] mb-1 tracking-tight">分享你的素颜证书</h3>
                    <p className="text-xs text-[#8c7a6b] mb-4 leading-relaxed">
                      让好友见证您的肌肤蜕变
                    </p>

                    <div className="w-full space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSavePoster}
                        disabled={isGeneratingPoster}
                        className="relative w-full py-3.5 px-6 rounded-full shadow-[0_4px_12px_-2px_rgba(150,110,60,0.2)] border border-[#e6d0a8]/50 group transition-all disabled:opacity-60"
                        style={{
                          background: 'linear-gradient(135deg, #fdf6e9 0%, #f5dfb8 50%, #e6d0a8 100%)',
                        }}
                      >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/30 pointer-events-none" />
                        <span className="relative z-10 text-[#5e4b3c] text-sm font-bold flex items-center justify-center gap-2 tracking-wide">
                          {isGeneratingPoster ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>保存分享海报</>
                          )}
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

                  {/* 右侧：海报预览 */}
                  <div
                    className="shrink-0 rounded-xl p-[2px] overflow-hidden shadow-sm"
                    style={{
                      width: 241,
                      height: 429,
                      background: 'linear-gradient(135deg, #e6d0a8 0%, #f5dfb8 50%, #d4b483 100%)',
                    }}
                  >
                    <div className="w-full h-full rounded-[10px] overflow-hidden bg-white">
                      <div style={{ width: 360, height: 640, transform: 'scale(0.67)', transformOrigin: '0 0' }}>
                        <SharePoster
                          ref={posterRef}
                          nickname={nickname}
                          score={score}
                          skinAge={skinAge}
                          percentile={rankPercentile}
                          avatar={currentAvatar}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
