'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Share2, Lock } from 'lucide-react';
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
  };
}

const AnimatedNumber = ({ value, duration = 1.5 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      onAnimationStart={() => {
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
      }}
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

  const rankPercentile = useMemo(() => {
    const percentiles = Object.values(data.dimensions)
      .filter((dim): dim is Dimension => dim !== undefined && dim.percentile !== undefined)
      .map((dim) => dim.percentile as number);
    return percentiles.length > 0 ? Math.max(...percentiles) : 96;
  }, [data.dimensions]);

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
    <div 
      className="min-h-screen font-sans text-[#7a6552]"
      style={{
        backgroundImage: 'url(/images/result-bg.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Header hidden or customized as per design (design doesn't show standard header) */}
      <div className="pt-12 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center">
        <img 
          src="/images/NIHPLOD-logo.svg" 
          alt="NIHPLOD MONACO" 
          className="h-10 mb-8 object-contain"
        />

        <div className="w-full flex flex-col gap-6">
          {/* Share Version Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-[32px] p-6 lg:p-10 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 248, 235, 0.95) 0%, rgba(245, 230, 205, 0.9) 100%)',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1), inset 0 2px 0 rgba(255,255,255,0.7)',
            }}
          >
            <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-10 relative z-10 w-full">
              
              {/* Left Column: Tag + Avatar properly aligned */}
              <div className="flex flex-col items-start gap-4 shrink-0 mt-1">
                {/* Tag */}
                <div className="relative flex items-center justify-center w-[84px] h-[26px] -ml-[14px]">
                  <img 
                    src="/images/version-tag.svg" 
                    alt="标签背景" 
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none" 
                  />
                  <span className="relative z-10 text-[#3d2f25] text-[10px] font-bold">
                    分享版
                  </span>
                </div>

                {/* Avatar with Ring */}
                <div className="relative flex items-center justify-center w-[100px] h-[100px]">
                  {/* The SVG Frame */}
                  <img 
                    src="/images/avatar-frame.svg" 
                    alt="frame" 
                    className="absolute inset-0 w-full h-full z-10 pointer-events-none object-contain scale-[1.1]" 
                  />
                  {/* Inner Avatar Content */}
                  <div className="w-[72%] h-[72%] rounded-full overflow-hidden shrink-0 mt-[2%] ml-[2%]">
                    {data.generatedAvatar ? (
                      <img src={data.generatedAvatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#dfc9b2] flex items-center justify-center text-white text-2xl font-bold">
                        {data.nickname.charAt(0)}
                      </div>
                    )}
                  </div>
                  {/* Minimal name badge */}
                  <div className="absolute bottom-0 right-0 bg-[#2d2a26] text-white text-[10px] px-2.5 py-0.5 rounded-full whitespace-nowrap z-20 border-[2.5px] border-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                    {data.nickname}
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div className="flex flex-col pt-2 lg:pt-0 z-10 w-full">
                <p className="text-[#a89582] text-sm mb-1">亲爱的{data.nickname}：</p>
                <h2 className="text-2xl lg:text-3xl font-bold text-[#2d2a26] leading-snug mb-4">
                  你的素颜评分超越了<br/>
                  全国 <span className="text-3xl lg:text-4xl px-1">{rankPercentile}%</span> 的用户
                </h2>
                <p className="text-[#8c7a6b] text-sm leading-relaxed max-w-sm mb-6">
                    {data.guestAnalysis?.summary || "整体状态极佳，肌肤屏障健康，水油平衡度完美，仅在眼周区域存在轻微色素沉积。"}
                  </p>
                  
                  {/* Share Button & Handwritten note */}
                  <div className="flex items-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowShareModal(true)}
                      className="focus:outline-none"
                    >
                      <img 
                        src="/images/share-btn.svg" 
                        alt="分享我的素颜证书" 
                        className="h-10 sm:h-11 object-contain drop-shadow-sm pointer-events-none" 
                      />
                    </motion.button>
                    <div className="hidden sm:block text-[#c4aca4] italic font-serif text-sm">
                      <span className="inline-block border-t border-[#c4aca4]/30 w-8 mr-2 align-middle"></span>
                      分享至小红书<br/>参与抽奖赢好礼！
                    </div>
                  </div>
                </div>

              {/* Decorative Image Area (Right) - Simplified via CSS shapes for structure */}
              <div className="absolute right-0 bottom-0 w-1/3 h-full opacity-50 lg:opacity-100 mix-blend-multiply flex items-end justify-end pointer-events-none">
                {/* You can place a gift box image here: <img src="/images/gift-box.png" /> */}
                <div className="w-full h-full bg-gradient-to-l from-[#f5dfb8]/40 to-transparent"></div>
              </div>
            </div>
          </motion.div>

          {/* Professional Version Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[32px] p-6 lg:p-8 backdrop-blur-xl border border-white/20"
            style={{
              background: 'linear-gradient(135deg, rgba(230, 215, 195, 0.4) 0%, rgba(200, 180, 155, 0.3) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <div className="flex flex-col lg:flex-row justify-between gap-8 h-full">
              {/* Left text column */}
              <div className="flex flex-col justify-between items-start h-full">
                <div>
                  <div className="bg-white/80 text-[#5c4937] px-3 py-1 rounded-full text-xs font-medium inline-block mb-4 shadow-sm border border-white/50">
                    专业版
                  </div>
                  <h2 className="text-2xl font-bold text-white drop-shadow-md mb-2">深度检测报告</h2>
                  <p className="text-[#f5ebd7] text-xs max-wxs leading-relaxed mb-6 font-medium tracking-wide" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    基于千万级亚洲肌肤数据库，全方位解析您的肌肤问题。
                  </p>
                </div>

                {!user && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openAuthModal('register')}
                    className="focus:outline-none"
                  >
                    <img 
                      src="/images/login-btn.svg" 
                      alt="登录查看完整报告" 
                      className="h-10 sm:h-11 object-contain drop-shadow-sm pointer-events-none" 
                    />
                  </motion.button>
                )}
              </div>

              {/* Right Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-1">
                {/* Comprehensive Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="p-4 rounded-2xl flex flex-col justify-between"
                  style={{
                    background: 'linear-gradient(180deg, rgba(230,220,205,0.7) 0%, rgba(240,230,215,0.5) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  <p className="text-xs text-[#7a6552] mb-6 font-medium">综合评分</p>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-[#5c4937] leading-none">
                      <AnimatedNumber value={data.score} duration={1.5} />
                    </span>
                    <span className="text-xs text-[#7a6552] ml-1 font-medium">分</span>
                  </div>
                </motion.div>

                {/* Skin Age */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                  className="p-4 rounded-2xl flex flex-col justify-between"
                  style={{
                    background: 'linear-gradient(180deg, rgba(240,225,215,0.8) 0%, rgba(255,245,230,0.6) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                >
                  <p className="text-xs text-[#7a6552] mb-6 font-medium">肌肤年龄</p>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-[#5c4937] leading-none">
                      <AnimatedNumber value={data.skinAge} duration={1.5} />
                    </span>
                    <span className="text-xs text-[#7a6552] ml-1 font-medium">岁</span>
                  </div>
                </motion.div>

                {/* T-zone Indicator */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-4 rounded-2xl flex flex-col justify-between"
                  style={{
                    background: 'linear-gradient(180deg, rgba(230,225,215,0.6) 0%, rgba(245,240,230,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                  }}
                >
                  <p className="text-xs text-[#7a6552] mb-6 font-medium">油脂分泌</p>
                  <div className="flex items-center h-full">
                    <span className="text-base font-bold text-[#5c4937]">{getTZoneLabel}</span>
                  </div>
                </motion.div>

                {/* Login Unlock Box */}
                {!user ? (
                   <motion.div
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 0.4 }}
                   className="p-4 rounded-2xl flex flex-col items-center justify-center border border-dashed border-white/50"
                   style={{
                     background: 'rgba(255,255,255,0.1)',
                   }}
                 >
                   <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center mb-2 shadow-sm">
                    <Lock className="w-4 h-4 text-[#8c7a6b]" />
                   </div>
                   <p className="text-[#5c4937] text-xs font-medium text-center">登录解锁<br/>更多数据</p>
                 </motion.div>
                ) : (
                  <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="p-4 rounded-2xl flex flex-col justify-between"
                  style={{
                    background: 'linear-gradient(180deg, rgba(230,225,215,0.6) 0%, rgba(245,240,230,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                  }}
                >
                  <p className="text-xs text-[#7a6552] mb-6 font-medium">肌肤类型</p>
                  <div className="flex items-center h-full">
                    <span className="text-base font-bold text-[#5c4937]">已解锁</span>
                  </div>
                </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        
        <p className="text-center text-[#c4b5a2] text-xs mt-6 tracking-widest">AI综合分析结果</p>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4">分享检测结果</h3>
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
                >
                  <Share2 className="w-4 h-4" />
                  分享链接
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-3 px-4 bg-slate-200 text-slate-900 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                >
                  关闭
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
