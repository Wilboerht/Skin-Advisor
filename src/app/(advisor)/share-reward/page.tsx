"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Gift,
    Upload,
    Loader2,
    MapPin,
    Phone,
    User,
    CheckCircle,
    AlertCircle,
    Clock,
    Image as ImageIcon,
    ChevronLeft,
    Calendar,
    Users
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { uploadImage } from "@/lib/upload-client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Campaign {
    id: string;
    name: string;
    description: string;
    rewardType: string;
    rewardDescription: string;
    startDate: string;
    endDate: string;
    rules: string;
    bannerImage: string | null;
    remainingSlots: number | null;
    isFull: boolean;
}

// Main page component wrapped with Suspense
export default function ShareRewardPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-[#F0EDE1]">
                <Loader2 className="h-8 w-8 animate-spin text-[#3D4430]" />
            </div>
        }>
            <ShareRewardContent />
        </Suspense>
    );
}

function ShareRewardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();

    // URL params
    const score = searchParams.get("score");
    const percentile = searchParams.get("percentile");

    // State
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [existingSubmission, setExistingSubmission] = useState<{
        id: string;
        status: string;
        createdAt: string;
    } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        address: ""
    });
    const [proofImage, setProofImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Active Campaign + check existing submission status
    useEffect(() => {
        const fetchCampaignAndStatus = async () => {
            try {
                const res = await fetch("/api/advisor/share-reward/active");
                const data = await res.json();

                if (data.success && data.data) {
                    setCampaign(data.data);

                    // Check if user already submitted for this campaign
                    const savedPhone = localStorage.getItem("share_reward_phone");
                    if (savedPhone) {
                        try {
                            const statusRes = await fetch(
                                `/api/advisor/share-reward/status?phone=${encodeURIComponent(savedPhone)}&campaignId=${data.data.id}`
                            );
                            const statusData = await statusRes.json();
                            if (statusData.success && statusData.data) {
                                setExistingSubmission(statusData.data);
                            }
                        } catch { /* ignore status check failure */ }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch campaign", error);
                toast.error("加载活动信息失败");
            } finally {
                setLoading(false);
            }
        };

        fetchCampaignAndStatus();
    }, [toast]);

    // Handlers
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        if (!file.type.startsWith("image/")) {
            toast.error("请上传图片文件");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("图片大小不能超过 5MB");
            return;
        }

        setUploading(true);
        try {
            const url = await uploadImage(file, `reward_proof_${Date.now()}.jpg`);
            setProofImage(url);
            toast.success("截图上传成功");
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("图片上传失败，请重试");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!proofImage) {
            toast.error("请上传分享截图作为凭证");
            return;
        }

        if (!campaign) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/advisor/share-reward/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    shareProofUrl: proofImage,
                    skinScore: score ? parseInt(score) : undefined,
                    percentile: percentile ? parseInt(percentile) : undefined,
                    campaignId: campaign.id
                })
            });

            const data = await res.json();

            if (data.success) {
                // Save phone for future status checks
                localStorage.setItem("share_reward_phone", formData.phone);
                setExistingSubmission(data.data);
                setSuccess(true);
                toast.success("提交成功！");
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                toast.error(data.error || "提交失败");
            }
        } catch (error) {
            toast.error("网络错误，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F0EDE1]">
                <Loader2 className="h-8 w-8 animate-spin text-[#3D4430]" />
            </div>
        );
    }

    // Render submission status badge
    const renderStatusBadge = (status: string) => {
        const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
            pending: { label: "审核中", color: "bg-amber-100 text-amber-700", icon: <Clock className="w-4 h-4" /> },
            approved: { label: "已通过", color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-4 h-4" /> },
            shipped: { label: "已发货", color: "bg-blue-100 text-blue-700", icon: <Gift className="w-4 h-4" /> },
            rejected: { label: "未通过", color: "bg-red-100 text-red-700", icon: <AlertCircle className="w-4 h-4" /> }
        };
        const config = statusConfig[status] || statusConfig.pending;
        return (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${config.color}`}>
                {config.icon} {config.label}
            </span>
        );
    };

    if (success || existingSubmission) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F0EDE1] p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-[#3D4430]/10"
                >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">
                        {success ? "申请提交成功!" : "您已提交申请"}
                    </h2>
                    <p className="mt-4 text-[#5E5E5E]">
                        我们会尽快审核您的截图凭证。<br />
                        审核通过后，奖品将寄送至您填写的地址。
                    </p>
                    {existingSubmission && (
                        <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">申请状态</p>
                            {renderStatusBadge(existingSubmission.status)}
                            {existingSubmission.createdAt && (
                                <p className="text-xs text-gray-400 mt-2">
                                    提交时间：{new Date(existingSubmission.createdAt).toLocaleString("zh-CN")}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="mt-8 space-y-3">
                        <Link
                            href="/"
                            className="block w-full rounded-full bg-[#3D4430] py-3 text-sm font-medium text-white transition-colors hover:bg-[#2C3222]"
                        >
                            返回首页
                        </Link>
                        {score && (
                            <Link
                                href="/result"
                                className="block w-full rounded-full border border-[#3D4430]/20 py-3 text-sm font-medium text-[#3D4430] transition-colors hover:bg-slate-50"
                            >
                                查看该次检测结果
                            </Link>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#F0EDE1] p-6 text-center">
                <div className="rounded-full bg-[#3D4430]/5 p-6 mb-6">
                    <Gift className="h-12 w-12 text-[#3D4430]/40" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-[#1A1A1A]">暂无正在进行的活动</h2>
                <p className="mt-2 text-[#5E5E5E] max-w-sm">
                    当前的福利活动已结束或尚未开始。请持续关注我们的更新！
                </p>
                <Link
                    href="/"
                    className="mt-8 rounded-full border border-[#3D4430] px-8 py-2.5 text-sm font-medium text-[#3D4430] transition-colors hover:bg-[#3D4430] hover:text-white"
                >
                    返回首页
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F0EDE1] pb-12">
            {/* Header / Nav */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="ml-2 font-medium text-[#1A1A1A]">福利领取中心</span>
                </div>
            </div>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* Campaign Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#3D4430]/5 overflow-hidden">
                    {campaign.bannerImage && (
                        <div className="aspect-[21/9] w-full relative bg-gray-100">
                            <img
                                src={campaign.bannerImage}
                                alt={campaign.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-serif font-bold text-[#1A1A1A]">{campaign.name}</h1>
                                <p className="mt-2 text-[#5E5E5E]">{campaign.description}</p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-2">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${campaign.isFull
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700"
                                    }`}>
                                    {campaign.isFull ? "额满" : "进行中"}
                                </span>
                            </div>
                        </div>

                        {/* Stats / Info */}
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                                    <Gift className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">本期奖品</p>
                                    <p className="text-sm font-medium text-gray-900">{campaign.rewardDescription || campaign.rewardType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">剩余名额</p>
                                    <p className="text-sm font-medium text-gray-900">
                                        {campaign.remainingSlots !== null ? `${campaign.remainingSlots} 位` : "不限"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Rules */}
                        {campaign.rules && (
                            <div className="mt-4 rounded-lg bg-[#F0EDE1]/50 p-4">
                                <h3 className="text-sm font-bold text-[#3D4430] flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    活动规则
                                </h3>
                                <p className="text-xs text-[#5E5E5E] leading-relaxed whitespace-pre-line">
                                    {campaign.rules}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Submission Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-[#3D4430]/5 p-6">
                    <h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3D4430] text-xs text-white">1</span>
                        填写收货信息
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1">收件人姓名</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="block w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-[#3D4430] focus:ring-1 focus:ring-[#3D4430] outline-none transition-all"
                                    placeholder="请输入真实姓名"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1">联系电话</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    className="block w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-[#3D4430] focus:ring-1 focus:ring-[#3D4430] outline-none transition-all"
                                    placeholder="用于接收快递通知"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#5E5E5E] mb-1">详细地址</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    className="block w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:border-[#3D4430] focus:ring-1 focus:ring-[#3D4430] outline-none transition-all"
                                    placeholder="省 / 市 / 区 / 街道 / 门牌号"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-gray-100 pt-8">
                        <h2 className="text-lg font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3D4430] text-xs text-white">2</span>
                            上传活动凭证
                        </h2>

                        <p className="text-sm text-[#5E5E5E] mb-4">
                            请将您的肌肤报告分享至朋友圈或小红书，并截图上传。<br />
                            <span className="text-xs text-orange-600">* 图片需清晰可见</span>
                        </p>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer
                                ${proofImage ? "border-[#3D4430]/20 bg-[#3D4430]/5" : "border-gray-200 hover:border-[#3D4430]/30 hover:bg-gray-50"}
                            `}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />

                            {uploading ? (
                                <div className="text-center">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#3D4430]" />
                                    <p className="mt-2 text-sm text-[#5E5E5E]">图片上传中...</p>
                                </div>
                            ) : proofImage ? (
                                <div className="relative w-full aspect-[4/3] max-w-xs mx-auto">
                                    <img src={proofImage} alt="Proof" className="w-full h-full object-contain rounded-lg shadow-sm" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                        <p className="text-white text-sm font-medium flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> 更换图片
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-3">
                                        <Upload className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-[#1A1A1A]">点击上传截图</p>
                                    <p className="text-xs text-gray-400 mt-1">支持 JPG, PNG (最大 5MB)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8">
                        <button
                            type="submit"
                            disabled={submitting || campaign.isFull || !proofImage}
                            className="w-full rounded-full bg-[#3D4430] py-3.5 text-base font-medium text-white shadow-lg shadow-[#3D4430]/20 hover:bg-[#2C3222] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {submitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    正在提交...
                                </span>
                            ) : campaign.isFull ? (
                                "活动名额已满"
                            ) : (
                                "确认提交领取"
                            )}
                        </button>
                        <p className="text-center text-xs text-gray-400 mt-4">
                            提交即代表您同意本活动规则。您的信息仅用于奖品寄送。
                        </p>
                    </div>
                </form>
            </main>
        </div>
    );
}
