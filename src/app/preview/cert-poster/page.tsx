"use client";

import ShareCardPage from "@/components/advisor/ShareCardPage";

/**
 * 临时预览页：用假数据渲染 ShareCardPage（手机端海报），
 * 仅用于对照 demo/cert-mobile.html 做视觉走查，验证完成后删除。
 */
export default function CertPosterPreviewPage() {
    return (
        <div className="min-h-screen bg-[#E8E2D9]">
            <div className="pt-8">
                <div className="max-w-[900px] mx-auto px-6 md:px-8">
                    <ShareCardPage
                        nickname="Hank1"
                        score={92}
                        percentile={96}
                        skinType="normal"
                        gender="female"
                        summary="好皮肤不是运气，是你与肌肤之间一场被认真履行的长期契约"
                        onDownloadPoster={() => {}}
                        onOpenReport={() => {}}
                        onReTest={() => {}}
                        onGift={() => {}}
                        certDate="2026-10-09"
                        certId="a3f9k2"
                    />
                    <div className="h-40" />
                </div>
            </div>
        </div>
    );
}
