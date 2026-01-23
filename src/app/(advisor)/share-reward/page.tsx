"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { ChevronLeft, Gift, Upload, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import Image from "next/image";
import { uploadImageToOSS } from "@/lib/oss-upload-client";
import { useSearchParams } from "next/navigation";
import { PromotionPoster } from "@/components/advisor/poster/PromotionPoster";

export default function ShareRewardPage() {
    const router = useRouter();
    const toast = useToast();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<"upload" | "form" | "success">("upload");
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);

        // 模拟预览
        const reader = new FileReader();
        reader.onload = (ev) => {
            setPreviewUrl(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        try {
            const url = await uploadImageToOSS(selectedFile);
            setUploadedUrl(url);
            setStep("form");
            toast.success("截图上传成功！");
        } catch (error) {
            console.error(error);
            toast.error("上传失败，请重试");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        try {
            const response = await fetch("/api/share-reward/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.get("name"),
                    phone: formData.get("phone"),
                    address: formData.get("address"),
                    shareProofUrl: uploadedUrl,
                    skinScore: searchParams.get("score"),
                    percentile: searchParams.get("percentile"),
                })
            });

            if (!response.ok) throw new Error("Submission failed");

            setStep("success");
            toast.success("领取成功！");
        } catch (error) {
            console.error(error);
            toast.error("提交失败，请重试");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F0EDE1] px-4 py-6">
            {/* 顶部导航 */}
            <div className="mb-8 flex items-center">
                <button
                    onClick={() => router.back()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-brand-charcoal transition-colors hover:bg-white"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <h1 className="ml-4 text-lg font-medium text-brand-charcoal font-serif">分享有礼</h1>
            </div>

            <div className="mx-auto max-w-md">
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-2xl bg-white shadow-card"
                >
                    {/* 活动头图 */}
                    <div className="relative h-40 bg-gradient-to-r from-rose-100 to-pink-100 p-6">
                        <div className="absolute right-4 top-4 opacity-20">
                            <Gift className="h-32 w-32 text-rose-500" />
                        </div>
                        <div className="relative z-10">
                            <span className="mb-2 inline-block rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-rose-500">
                                限时活动
                            </span>
                            <h2 className="text-2xl font-serif text-brand-charcoal">
                                分享肌肤报告<br />赢取惊喜好礼
                            </h2>
                        </div>
                    </div>

                    <div className="p-6">
                        {/* 步骤 1: 保存海报 */}
                        <div className="mb-8 space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-xs text-white">1</span>
                                <h2 className="font-medium text-brand-charcoal">保存专属海报并分享</h2>
                            </div>

                            <div className="flex justify-center">
                                <PromotionPoster
                                    skinScore={Number(searchParams.get("score") || 85)}
                                    percentile={Number(searchParams.get("percentile") || 90)}
                                />
                            </div>

                            <p className="text-xs text-brand-charcoal/60 px-1 text-center">
                                * 点击右下角按钮保存海报，分享至微信朋友圈、小红书等平台。
                            </p>
                        </div>

                        {/* 步骤 2: 填写信息并上传 */}
                        <div className="mb-8 space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-xs text-white">2</span>
                                <h2 className="font-medium text-brand-charcoal">截图并上传凭证</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Removed redundant text instuctions here as they are clear from context */}

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-beige bg-brand-cream/30 transition-colors hover:border-brand-gold hover:bg-brand-cream/50"
                                >
                                    {previewUrl ? (
                                        <div className="relative h-full w-full overflow-hidden rounded-xl">
                                            <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <span className="text-white text-sm">点击重新上传</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
                                                <Upload className="h-6 w-6" />
                                            </div>
                                            <p className="text-sm font-medium text-brand-charcoal/60">点击上传分享截图</p>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>

                                {step !== "form" && step !== "success" && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={!previewUrl || uploading}
                                        className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-charcoal py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                上传中...
                                            </>
                                        ) : (
                                            "确认上传"
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {step === "form" && (
                            <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-brand-beige/20">
                                <h3 className="text-lg font-serif mb-4 text-brand-charcoal">填写领取信息</h3>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="mb-1 block text-xs text-brand-charcoal/60">收件人姓名</label>
                                        <input name="name" required className="w-full rounded-lg border border-brand-beige bg-brand-cream/20 px-4 py-2 text-sm focus:border-brand-gold focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-brand-charcoal/60">联系电话</label>
                                        <input name="phone" required type="tel" className="w-full rounded-lg border border-brand-beige bg-brand-cream/20 px-4 py-2 text-sm focus:border-brand-gold focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-brand-charcoal/60">收货地址</label>
                                        <textarea name="address" required rows={3} className="w-full rounded-lg border border-brand-beige bg-brand-cream/20 px-4 py-2 text-sm focus:border-brand-gold focus:outline-none" />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={uploading}
                                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-charcoal py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                                    >
                                        {uploading ? "提交中..." : "提交领取"}
                                    </button>
                                </form>
                            </div>
                        )}

                        {step === "success" && (
                            <div className="py-8 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                                    <Check className="h-8 w-8" />
                                </div>
                                <h3 className="mb-2 text-xl font-medium text-brand-charcoal">领取申请已提交</h3>
                                <p className="mb-8 text-sm text-brand-charcoal/60">
                                    我们将尽快为您寄出专属好礼。<br />请留意短信通知。
                                </p>
                                <button
                                    onClick={() => router.push("/")}
                                    className="w-full rounded-full border border-brand-charcoal/20 bg-white py-3 text-sm font-medium text-brand-charcoal hover:bg-brand-cream/50"
                                >
                                    返回首页
                                </button>
                            </div>
                        )}
                    </div>
                </m.div>

                {/* 规则说明 */}
                <div className="mt-8 px-4 text-xs leading-relaxed text-brand-charcoal/40">
                    <p className="mb-2 font-medium">活动规则：</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>每位用户限领取一次奖励。</li>
                        <li>分享截图需清晰可见分析结果页。</li>
                        <li>工作人员将在 3 个工作日内完成审核。</li>
                        <li>本活动最终解释权归 NIHPLOD 所有。</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
