"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeft, RotateCcw } from "lucide-react";

function AnimatedNumber({ value, suffix = "" }: { value: number, suffix?: string }) {
    const spring = useSpring(0, { bounce: 0, duration: 2000 });
    const display = useTransform(spring, (current) => Math.round(current) + suffix);

    useEffect(() => {
        spring.set(value);
    }, [spring, value]);

    return <motion.span>{display}</motion.span>;
}

interface ShareLandingProps {
    data: {
        score: number;
        skinType: string;
        skinAge: number;
        dimensions: any;
        publishDate: string;
        nickname: string;
        city: string;
        isGuest: boolean;
        sessionId: string;
        generatedAvatar?: string;
        // Gender mismatch detection
        detectedGender?: { value: string; confidence: number } | null;
        // Guest simplified analysis
        guestAnalysis?: {
            summary: string;
            concerns: string[];
            tips: string[];
            skinTypeKey: string;
            hydrationLevel: string | null;
        };
    }
}

export default function ShareLandingClient({ data }: ShareLandingProps) {
    const router = useRouter();
    const { openAuthModal } = useAuthModal();
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();
    const [redirectAttempts, setRedirectAttempts] = useState(0);
    const redirectAttemptTimeRef = useRef<number>(0);

    // 登录成功后自动跳转到完整报告
    useEffect(() => {
        // 防止无限循环：只在用户已经完全加载且确实存在时才跳转
        if (!authLoading && user && data.isGuest) {
            // 防止在短时间内多次尝试重定向（防止循环）
            const now = Date.now();
            if (now - redirectAttemptTimeRef.current < 2000) {
                // 如果2秒内有多次重定向尝试，说明可能陷入循环，放弃
                if (redirectAttempts >= 2) {
                    console.error('🔴 Redirect loop detected - aborting auto-redirect');
                    toast.error("页面加载出现问题，请刷新重试或联系支持");
                    return;
                }
                setRedirectAttempts(prev => prev + 1);
            } else {
                // 重置计数
                setRedirectAttempts(0);
            }
            
            redirectAttemptTimeRef.current = now;

            // 延迟确保状态完全更新，并等待可能的服务端设置完成
            const timer = setTimeout(() => {
                console.log('✅ Redirecting to full report...');
                router.push(`/result?id=${data.sessionId}`);
            }, 500); // 增加延迟到500ms确保Cookie设置完毕
            return () => clearTimeout(timer);
        }
    }, [user, authLoading, data.isGuest, data.sessionId, router, redirectAttempts, toast]);

    // Gender Mismatch Detection
    const [socialGender, setSocialGender] = useState<string>(''); // Initialize empty to avoid flash mismatch
    const [showGenderMismatchModal, setShowGenderMismatchModal] = useState(false);

    // Read questionnaire gender from localStorage (available when guest just completed analysis on this device)
    useEffect(() => {
        const storedGender = localStorage.getItem("advisor_gender");
        if (storedGender) setSocialGender(storedGender);
    }, []);

    // Gender Mismatch Detection
    const isGenderMismatch = useMemo(() => {
        if (!data.detectedGender || !socialGender) return false;
        const { value: detectedVal, confidence: detectedConf } = data.detectedGender;

        // Normalize confidence
        const normalizedConf = detectedConf > 1 ? detectedConf / 100 : detectedConf;

        return detectedVal && normalizedConf > 0.85 && detectedVal !== socialGender;
    }, [data.detectedGender, socialGender]);

    useEffect(() => {
        if (isGenderMismatch) {
            const acked = localStorage.getItem('advisor_gender_mismatch_ack') === 'true';
            if (!acked) {
                setShowGenderMismatchModal(true);
            }
        }
    }, [isGenderMismatch]);

    const handleMismatchRetry = () => {
        localStorage.removeItem("advisor_answers");
        localStorage.removeItem("advisor_face_images");
        localStorage.removeItem("advisor_result");
        localStorage.removeItem("advisor_step");
        localStorage.setItem("advisor_free_retry", "true");
        localStorage.setItem('advisor_gender_mismatch_ack', 'true');
        router.push("/questions");
    };

    const handleMismatchContinue = () => {
        setShowGenderMismatchModal(false);
        localStorage.setItem('advisor_gender_mismatch_ack', 'true');
        toast.success("确认成功");
    };

    const [showModal, setShowModal] = useState(false);

    // Generate dynamic comment based on user's actual analysis data
    function generateComment(): string {
        const { score, skinType } = data;
        const concerns = data.guestAnalysis?.concerns || [];

        // Score-based praise
        let scorePraise = "";
        if (score >= 90) {
            scorePraise = "您的肌肤状态极为出色，各项指标均处于优秀区间";
        } else if (score >= 80) {
            scorePraise = "您的肌肤底子非常好，整体状态健康且有光泽";
        } else if (score >= 70) {
            scorePraise = "您的肌肤状态良好，略有需要关注的细节";
        } else if (score >= 60) {
            scorePraise = "您的肌肤有一定的提升空间，建议关注日常护理";
        } else {
            scorePraise = "您的肌肤正需要更多呵护，科学护肤可以带来显著改善";
        }

        // Concern-based advice
        let concernAdvice = "";
        if (concerns.length > 0) {
            const concernMap: Record<string, string> = {
                "痘痘": "注意温和清洁并避免挤压，含水杨酸的产品可以帮助控制痘痘",
                "暗沉": "加强防晒与使用含维C的精华，有助于提亮肤色",
                "干燥": "加强保湿屏障修复，含神经酰胺的面霜值得尝试",
                "皱纹": "建议加入含视黄醇的精华，帮助促进胶原蛋白生成",
                "色斑": "防晒是淡斑的基础，搭配烟酰胺精华效果更佳",
                "敏感": "选择低刺激性配方，避免含酒精和香精的产品",
                "黑眼圈": "改善睡眠质量的同时，含咖啡因的眼霜可以淡化黑眼圈",
                "出油": "控油的关键不是过度清洁，而是做好补水平衡",
            };
            const matched = concerns.find(c => concernMap[c]);
            if (matched) {
                concernAdvice = `。${concernMap[matched]}`;
            }
        }

        // Score-based closing
        let closing = "";
        if (score >= 85) {
            closing = "。坚持现有的护肤习惯，您已走在大多数人前面。";
        } else if (score >= 70) {
            closing = "。在日常护肤中坚持科学方法，期待下次更高的评分。";
        } else {
            closing = "。根据建议调整护肤方案，坚持会看到显著改善。";
        }

        return `报告评语：${scorePraise}，检测肤质为${skinType}${concernAdvice}${closing}`;
    }

    const comment = generateComment();

    // Animation Variants
    const revealVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] as any } // cubic-bezier matching ref
        })
    };

    return (
        <div className="min-h-screen bg-[#F0EDE1] font-sans text-[#333] p-5 flex justify-center items-start md:items-center overflow-x-hidden">
            <style jsx global>{`
                :root {
                    --primary-bg: #F0EDE1;
                    --accent-yellow: #FFD700;
                    --accent-blue: #00263e;
                    --glass-white: rgba(255, 255, 255, 0.4);
                    --glass-border: rgba(255, 255, 255, 0.6);
                }
                .glass-module {
                    background: var(--glass-white);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid var(--glass-border);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
                }
                .glass-module:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.06);
                }
            `}</style>

            {/* --- GENDER MISMATCH MODAL (Same as registered user page) --- */}
            <AnimatePresence>
                {showGenderMismatchModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-[#191919]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 8 }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] w-full max-w-[420px] overflow-hidden border border-[#E9E9E7]"
                        >
                            <div className="p-8">
                                {/* Header with Emoji */}
                                <div className="flex flex-col items-center text-center gap-5 mb-6">
                                    <div className="text-[42px] leading-none mb-1">⚠️</div>
                                    <div className="space-y-1.5">
                                        <h3 className="text-[18px] font-bold text-[#37352F] tracking-tight">测前信息准确性提示</h3>
                                        <p className="text-[13px] text-[#787774] font-medium">Data Accuracy Verification</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <p className="text-[14px] text-[#37352F] leading-[1.8] text-justify px-1">
                                        为了确保报告建议的严谨性，智能识别引擎对多维数据进行了对冲校验，发现当前的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">底层算法数据模型</span>
                                        与您在问卷中选择的<span className="font-semibold bg-[#F1F1EF] px-1.5 py-0.5 rounded text-[#37352F] mx-1 border border-[#E9E9E7]">性别选项 ({socialGender === 'male' ? '男' : '女'})</span> 存在一定程度的不一致。
                                    </p>

                                    {/* Notion Callout Block - Yellow */}
                                    <div className="bg-[#FBF3DB] bg-opacity-50 p-4 rounded-lg flex items-start gap-3.5 border border-[#FBF3DB]/60">
                                        <span className="text-[16px] shrink-0 mt-0.5">💡</span>
                                        <div className="space-y-2 text-[13px] text-[#37352F] leading-relaxed">
                                            <p className="opacity-90">这可能会影响为您匹配<span className="font-bold">"针对性护肤方案"</span>的精准度，导致分析结论与您的实际肤感产生偏差。</p>
                                            <div className="h-px bg-[#37352F]/5 w-full my-1"></div>
                                            <p className="opacity-90">建议核实信息以获得更准确的建议。若是填写有误？<span className="font-semibold text-[#D9730D]">本次重新填写不消耗测试次数</span>。</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 pt-2">
                                        <button
                                            onClick={handleMismatchContinue}
                                            className="w-full h-11 bg-[#37352F] text-white text-[14px] font-medium rounded-[6px] hover:bg-[#2C2C2C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <span>信息无误</span>
                                        </button>

                                        <button
                                            onClick={handleMismatchRetry}
                                            className="w-full h-11 bg-transparent text-[#787774] text-[14px] font-medium rounded-[6px] hover:bg-[#F1F1EF] hover:text-[#37352F] active:bg-[#E9E9E7] transition-all flex items-center justify-center gap-2"
                                        >
                                            <RotateCcw size={14} strokeWidth={2.5} />
                                            <span>我填错了，重新填写</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="w-full max-w-[600px] flex flex-col gap-6 pt-4 md:pt-0">
                <div className="flex justify-center relative items-center">
                    <button
                        onClick={() => router.push('/')}
                        className="absolute left-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/40 hover:bg-white/70 backdrop-blur-md transition-all text-[#333] shadow-sm border border-white/50 z-10"
                        aria-label="Back to home"
                    >
                        <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                    <img src="/NIHPLOD-logo.svg" alt="Partner Logo" className="h-8 md:h-10 object-contain opacity-90" />
                </div>
                <div className="w-full flex flex-col gap-6">

                    {/* 1. Challenge Module */}
                    <motion.div
                        custom={1}
                        initial="hidden"
                        animate="visible"
                        variants={revealVariants}
                        className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400 relative overflow-hidden"
                    >
                        <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5 bg-[#FFD700] text-black w-fit">
                            测肤大挑战
                        </span>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 rounded-3xl bg-[#eee] border-[3px] border-white overflow-hidden relative">
                                {/* Dynamic Avatar: Prioritize AI generated, fallback to DiceBear */}
                                <img
                                    src={data.generatedAvatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(data.nickname)}`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-bold mb-1">{data.nickname}</h2>
                                <p className="text-sm text-[#666]">{data.isGuest ? "临时用户 · " : ""}{data.city}</p>
                            </div>
                        </div>

                        <div className="text-base leading-[1.6] text-[#444] p-4 border-l-4 border-[#FFD700] bg-white/30 mb-[30px] rounded-r-xl min-h-[80px]">
                            {comment}
                        </div>

                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full py-[18px] bg-black text-white rounded-[20px] text-base font-semibold transition-transform active:scale-[0.98] hover:bg-[#333]"
                        >
                            分享我的战报
                        </button>
                        <p className="mt-[15px] text-[13px] text-[#666] text-center">
                            邀请好友开启素颜测肤大对决，赢取限时好礼。
                        </p>
                    </motion.div>

                    {/* 3. Report Module / Back Button */}
                    {user ? (
                        <motion.div
                            custom={2}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-[30px] flex flex-col items-center justify-center transition-all duration-400"
                        >
                            <p className="text-[#666] mb-4">✓ 登录成功，正在加载完整报告...</p>
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00263e] border-t-transparent"></div>
                        </motion.div>
                    ) : null}

                    {/* 4. Guest Simplified Analysis (New) */}
                    {data.isGuest && data.guestAnalysis && (
                        <motion.div
                            custom={2}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-[30px] flex flex-col transition-all duration-400"
                        >
                            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-5 bg-[#00263e] text-white w-fit">
                                初步诊断
                            </span>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <span className="text-2xl">🔍</span>
                                        肤质概览
                                    </h3>
                                    <div className="bg-white/40 rounded-2xl p-5 space-y-4 flex-grow">
                                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                                            <span className="text-[#666]">肤质类型</span>
                                            <span className="font-bold text-lg">{data.skinType}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-black/5 pb-3">
                                            <span className="text-[#666]">肌龄检测</span>
                                            <span className="font-bold text-lg">{data.skinAge}岁</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[#666]">主要关注</span>
                                            <div className="flex gap-2">
                                                {data.guestAnalysis.concerns.map(c => (
                                                    <span key={c} className="text-xs bg-[#FF4D4F]/10 text-[#FF4D4F] px-2 py-1 rounded-md font-medium">
                                                        {c}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <span className="text-2xl">📝</span>
                                        分析摘要
                                    </h3>
                                    <div className="bg-white/40 rounded-2xl p-5 flex flex-col flex-grow relative">
                                        <div className="text-[#444] leading-relaxed relative z-10 text-sm flex-grow mb-3">
                                            <p className="line-clamp-4">
                                                {data.guestAnalysis.summary}
                                            </p>
                                        </div>
                                        {/* Optional gradient effect if needed, though without absolute positioning it's cleaner without it, dropping it here for simplicity and clean UI */}
                                        <div className="flex justify-end items-end shrink-0 z-20">
                                            <button
                                                onClick={() => openAuthModal('register')}
                                                className="text-[#00263e] text-xs font-bold hover:underline flex items-center gap-1"
                                            >
                                                查看完整分析 →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tips Teaser */}
                            <div className="bg-[#00263e]/5 rounded-2xl p-5">
                                <h4 className="font-bold flex items-center gap-2 mb-3 text-[#00263e]">
                                    <span>💡</span> 护肤小贴士
                                </h4>
                                <ul className="space-y-2">
                                    {data.guestAnalysis.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-[#444]">
                                            <span className="text-[#00263e] mt-1">•</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    )}

                    {/* 5. Locked Full Report Teaser (Guest Only) */}
                    {data.isGuest && (
                        <motion.div
                            custom={4}
                            initial="hidden"
                            animate="visible"
                            variants={revealVariants}
                            className="glass-module rounded-[32px] p-0 flex flex-col transition-all duration-400 md:col-span-2 relative overflow-hidden"
                        >
                            {/* Blurred Content Background used as teaser */}
                            <div className="absolute inset-0 p-8 filter blur-[8px] opacity-60 pointer-events-none select-none overflow-hidden">
                                <div className="flex justify-between items-end mb-8">
                                    <div className="w-1/2 h-8 bg-black/10 rounded-lg"></div>
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="h-32 bg-white/50 rounded-2xl"></div>
                                    <div className="h-32 bg-white/50 rounded-2xl"></div>
                                </div>
                                <div className="h-60 bg-white/50 rounded-2xl mb-4"></div>
                                <div className="space-y-4">
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                    <div className="h-12 bg-black/5 rounded-xl"></div>
                                </div>
                            </div>

                            {/* Lock Overlay Content */}
                            <div className="relative z-10 flex flex-col items-center justify-center bg-gradient-to-b from-white/30 to-white/90 p-10 md:p-16 text-center w-full min-h-[400px]">
                                <div className="w-16 h-16 bg-[#00263e] rounded-full flex items-center justify-center mb-6 shadow-xl text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>

                                <h3 className="text-2xl font-bold text-[#1A1A1A] mb-3">解锁 30+ 页完整专业报告</h3>
                                <p className="text-[#666] max-w-md mb-8 leading-relaxed">
                                    注册账户即可永久保存您的测肤数据，解锁十二维深度分析雷达图、
                                    个性化护肤方案生成、以及成分级产品推荐。
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                    <button
                                        onClick={() => openAuthModal('register')}
                                        className="flex-1 py-4 bg-[#00263e] text-white rounded-xl font-bold text-base shadow-lg hover:bg-[#003859] hover:scale-[1.02] transition-all"
                                    >
                                        立即注册解锁
                                    </button>
                                    <button
                                        onClick={() => openAuthModal('login')}
                                        className="flex-1 py-4 bg-white/80 backdrop-blur-sm border border-black/10 text-[#333] rounded-xl font-bold text-base shadow-sm hover:bg-white transition-all"
                                    >
                                        已有账号登录
                                    </button>
                                </div>

                                <p className="mt-8 text-[13px] text-[#888] font-medium bg-black/5 px-4 py-2 rounded-full inline-flex items-center gap-2">
                                    <span>🎁</span> 新用户注册限时解锁高级功能
                                </p>
                            </div>
                        </motion.div>
                    )}

                </div>
                {/* Footer */}
                <div className="w-full text-center py-8 text-[#999] text-xs font-medium opacity-80">
                    © 2026 NIHPLOD. All Rights Reserved.
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-center"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="bg-[#F0EDE1] w-[90%] max-w-[400px] rounded-[32px] p-[40px] text-center transform scale-90"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-center mb-6">
                                <img src="/NIHPLOD-logo.svg" alt="NIHPLOD" className="h-9.5 object-contain" />
                            </div>
                            <h2 className="text-xl font-bold mb-[15px] leading-relaxed">
                                您的当前数据已入选<br />素颜测肤排位全国较前排名
                            </h2>
                            <p className="text-[#666] mb-[30px] text-[15px] leading-relaxed">
                                在赛季结束之前有概率获得礼品，请选择后续操作。
                            </p>
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        openAuthModal('register');
                                    }}
                                    className="py-[18px] px-6 rounded-[20px] border-none font-bold text-[16px] cursor-pointer transition-transform active:scale-[0.98] bg-[#00263e] text-white hover:bg-[#003859] shadow-lg flex items-center justify-center gap-2"
                                >
                                    <span>🎁</span> 立即注册，解锁报告
                                </button>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        openAuthModal('login');
                                    }}
                                    className="py-[18px] px-6 rounded-[20px] font-bold text-[15px] cursor-pointer transition-transform active:scale-[0.98] bg-white/60 backdrop-blur-md border border-white/80 text-[#333] hover:bg-white flex items-center justify-center"
                                >
                                    已有账号，一键登录
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowModal(false);
                                        // 尝试调用原生分享
                                        if (navigator.share) {
                                            try {
                                                await navigator.share({
                                                    title: '我的AI测肤战报',
                                                    text: `我在Skin Advisor获得了${data.score}分的肌肤评分！`,
                                                    url: window.location.href,
                                                });
                                                return;
                                            } catch (err) {
                                                // 分享取消或失败，回退到复制链接
                                            }
                                        }
                                        // 回退方案：复制链接
                                        try {
                                            await navigator.clipboard.writeText(window.location.href);
                                            toast.success("链接已复制，快去分享给好友吧！");
                                        } catch (err) {
                                            toast.error("复制失败，请手动复制浏览器链接");
                                        }
                                    }}
                                    className="pt-2 pb-1 bg-transparent text-[#888] underline text-[14px] hover:text-[#555] font-medium"
                                >
                                    暂不注册，仅分享战报
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
