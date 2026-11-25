"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLegalDocModal } from "@/components/website/LegalDocModalContext";
import { recordClientConsent } from "@/lib/consent-client";
import { Checkbox } from "@/components/ui/checkbox";

interface PrivacyConsentProps {
    onConsent: () => void;
}

export function PrivacyConsent({ onConsent }: PrivacyConsentProps) {
    const [agreed, setAgreed] = useState(false);
    const [sensitiveAgreed, setSensitiveAgreed] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const { openLegalDoc } = useLegalDocModal();
    const consentCheckboxClass =
        "mt-0.5 size-5 shrink-0 rounded-[5px] border-olive/30 bg-card shadow-none focus-visible:ring-olive/30 data-[state=checked]:border-olive data-[state=checked]:bg-olive";

    return (
        <div className="flex w-full flex-col items-center">
            <m.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 sm:mb-8 text-center"
            >
                <span className="mb-3 inline-block rounded-md bg-olive/5 px-4 py-1.5 text-[11px] font-medium tracking-wider text-olive">
                    开始之前
                </span>
                <h2 className="font-sans text-2xl md:text-3xl text-text-primary">
                    您的隐私对我们至关重要
                </h2>
                <p className="mt-2 text-sm text-brand-ink-muted font-light max-w-md mx-auto">
                    为了提供精准的 AI 肤质分析，我们需要采集您的面部照片和问卷信息。
                    请阅读并确认以下隐私条款。
                </p>
            </m.div>

            <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full max-w-lg space-y-4"
            >
                {/* 核心摘要卡片 */}
                <div className="rounded-xl border border-olive/10 bg-card/60 backdrop-blur-md p-5 sm:p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive/5">
                            <Shield className="h-5 w-5 text-olive" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-text-primary">数据收集范围</h3>
                            <p className="mt-1 text-xs text-brand-ink-muted leading-relaxed">
                                我们收集您的面部照片（仅用于 AI 分析，不用于其他目的）、问卷答案、设备信息（用于优化体验）、根据 IP 推断的省/市级粗略位置（用于地域化建议与统计）以及分析结果。
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-olive/10" />

                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive/5">
                            <Shield className="h-5 w-5 text-olive" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-text-primary">数据存储与安全</h3>
                            <p className="mt-1 text-xs text-brand-ink-muted leading-relaxed">
                                面部照片仅用于本次分析，分析完成后立即删除，异常情况下最迟 24 小时内删除；完整测肤报告保留 365 天，脱敏趋势摘要最长保留 3 年。我们不会将您的数据出售给第三方。
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-olive/10" />

                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-olive/5">
                            <Shield className="h-5 w-5 text-olive" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-text-primary">AI 分析说明</h3>
                            <p className="mt-1 text-xs text-brand-ink-muted leading-relaxed">
                                您的照片将发送至 AI 视觉模型进行肤质分析。分析完成后，本站会立即删除上传副本；服务商侧的数据保留与删除以其服务协议为准。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 详细条款折叠 */}
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 min-h-[44px] py-2 px-1 -mx-1 text-xs text-olive/60 hover:text-olive transition-colors mx-auto"
                >
                    <span>{showDetails ? "收起" : "查看完整隐私政策与服务条款"}</span>
                    <ChevronRight
                        size={12}
                        className={cn("transition-transform", showDetails && "rotate-90")}
                    />
                </button>

                {showDetails && (
                    <m.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="rounded-lg border border-olive/10 bg-[#F8F7F4] p-4 text-xs text-brand-ink-muted leading-relaxed space-y-2 max-h-48 overflow-y-auto"
                    >
                        <p>1. 我们尊重并保护所有用户的个人隐私权。</p>
                        <p>2. 面部照片仅用于 AI 肤质分析，不会用于人脸识别训练或其他商业用途。</p>
                        <p>3. 您有权随时要求删除您的个人数据，请联系客服。</p>
                        <p>4. 未经您明确同意，我们不会向第三方共享您的个人身份信息。</p>
                        <p>5. 使用本服务即表示您同意我们的隐私政策和服务条款。</p>
                    </m.div>
                )}

                {/* 同意操作区 */}
                <div className="pt-2 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                            id="consent-privacy"
                            checked={agreed}
                            onCheckedChange={(checked) =>
                                setAgreed(checked === true)
                            }
                            className={consentCheckboxClass}
                        />
                        <span className="text-xs text-brand-ink-muted leading-relaxed">
                            我已阅读并同意
                            {/* 位于 <label> 内：preventDefault 阻止触发达成勾选，stopPropagation 阻止冒泡 */}
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalDoc("privacy"); }} className="text-olive underline underline-offset-2 mx-0.5 cursor-pointer">《隐私政策》</button>
                            和
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegalDoc("terms"); }} className="text-olive underline underline-offset-2 mx-0.5 cursor-pointer">《服务条款》</button>
                            ，了解并同意上述数据收集与使用方式。
                        </span>
                    </label>

                    {/* 敏感个人信息单独同意：不能与隐私政策/服务条款合并为一个勾选 */}
                    <label className="flex items-start gap-3 cursor-pointer text-xs text-brand-ink-muted leading-relaxed">
                        <Checkbox
                            id="consent-sensitive"
                            checked={sensitiveAgreed}
                            onCheckedChange={(checked) =>
                                setSensitiveAgreed(checked === true)
                            }
                            className={consentCheckboxClass}
                        />
                        <span>
                            我单独同意处理我的敏感个人信息（面部照片、肤质与健康状况），仅用于本次 AI 肤质分析与报告生成。
                        </span>
                    </label>

                    <button
                        onClick={async () => {
                            if (!agreed || !sensitiveAgreed || saving) return;
                            setSaving(true);
                            setSubmitError("");
                            const recorded = await recordClientConsent();
                            setSaving(false);
                            if (!recorded || recorded.missing.length > 0) {
                                setSubmitError("同意记录同步失败，请检查网络后重试。");
                                return;
                            }
                            onConsent();
                        }}
                        disabled={!agreed || !sensitiveAgreed || saving}
                        className={cn(
                            "w-full py-3.5 rounded-xl text-sm font-medium tracking-wide transition-all duration-300",
                            agreed && sensitiveAgreed && !saving
                                ? "bg-text-primary text-white hover:bg-[#333] shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                : "bg-text-primary/10 text-text-primary/30 cursor-not-allowed"
                        )}
                    >
                        {saving ? "正在提交…" : "同意并继续"}
                    </button>
                    {submitError ? (
                        <p className="text-xs text-red-600" role="alert">
                            {submitError}
                        </p>
                    ) : null}
                </div>
            </m.div>
        </div>
    );
}

// 兼容旧引用：实际实现已移到 lib/consent-storage（纯存储，不引入 UI）
export { hasPrivacyConsent, getPrivacyConsentPayload } from "@/lib/consent-storage";
