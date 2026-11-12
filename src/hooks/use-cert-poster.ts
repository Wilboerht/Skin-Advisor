"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isMobileDevice, isWeChatBrowser } from "@/lib/share-device";
import { renderCertImage, type CertVariant } from "@/lib/cert-image";
import { fetchWithCsrf } from "@/lib/fetch-client";
import { sanitizeFilename } from "@/lib/poster-utils";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { skinTypes } from "@/lib/result-content";
import { useToast } from "@/components/ui/Toast";
import { useLazyOpen } from "@/hooks/use-lazy-open";

async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("读取海报图片失败"));
        };
        reader.onerror = () => reject(reader.error ?? new Error("读取海报图片失败"));
        reader.readAsDataURL(blob);
    });
}

interface UseCertPosterParams {
    sessionId?: string;
    isMock: boolean;
    nickname: string;
    persona: string;
    gender: string;
    overallScore?: number;
    percentile: number | null;
    percentileSampleSize: number;
    analyzedAt?: string;
    /** 真正触发下载/分享后调用（分享埋点） */
    onShared: () => void;
}

/**
 * 证书海报：端侧 canvas 合成 + 服务端 sharp 兜底 + 保存/分享状态。
 * 从 ResultClient 拆出，避免页面组件继续膨胀；行为与拆分前保持一致。
 */
export function useCertPoster({
    sessionId,
    isMock,
    nickname,
    persona,
    gender,
    overallScore,
    percentile,
    percentileSampleSize,
    analyzedAt,
    onShared,
}: UseCertPosterParams) {
    const toast = useToast();
    const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
    const [posterError, setPosterError] = useState<string | null>(null);
    const [savedPosterForSave, setSavedPosterForSave] = useState<string | null>(null);
    const [posterSaveIsDesktop, setPosterSaveIsDesktop] = useState(false);
    const [certVariant, setCertVariant] = useState<CertVariant>("qr");
    const [showCertVariantPicker, setShowCertVariantPicker] = useState(false);
    const shouldRenderCertVariantPicker = useLazyOpen(showCertVariantPicker);

    const savedPosterForSaveRef = useRef<string | null>(null);
    const posterBusyRef = useRef(false);
    const savedPosterTrackedRef = useRef(false);

    const setSavedPosterUrl = useCallback((url: string | null) => {
        const prev = savedPosterForSaveRef.current;
        if (prev && prev !== url && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        savedPosterForSaveRef.current = url;
        setSavedPosterForSave(url);
    }, []);

    // 记忆上次版式
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.ADVISOR_CERT_VARIANT);
            if (saved === "qr" || saved === "noqr") setCertVariant(saved);
        } catch { /* ignore */ }
    }, []);

    // 弹窗打开时直接离开页面的兜底：卸载时释放 objectURL（dataURL 无需释放）
    useEffect(() => () => {
        const url = savedPosterForSaveRef.current;
        if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    }, []);

    // 海报错误提示自动消失（6s）
    useEffect(() => {
        if (!posterError) return;
        const timer = setTimeout(() => setPosterError(null), 6000);
        return () => clearTimeout(timer);
    }, [posterError]);

    const triggerDownload = useCallback(async (blob: Blob, filename: string): Promise<boolean> => {
        const blobUrl = URL.createObjectURL(blob);
        const file = new File([blob], filename, { type: "image/png" });
        const isMobile = isMobileDevice(navigator.userAgent, navigator.maxTouchPoints);
        let canShareFiles = false;
        try {
            canShareFiles = typeof navigator.share === "function" &&
                typeof navigator.canShare === "function" &&
                navigator.canShare({ files: [file] });
        } catch {
            canShareFiles = false;
        }

        if (isMobile && canShareFiles) {
            try {
                await navigator.share({ title: "我的肌智派证书", files: [file] });
                URL.revokeObjectURL(blobUrl);
                return true;
            } catch (err) {
                const cancelled = typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
                if (cancelled) {
                    URL.revokeObjectURL(blobUrl);
                    return false;
                }
                console.log("navigator.share failed, fallback to download", err);
            }
        }

        const link = document.createElement("a");
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        toast.success("证书已开始下载");
        return true;
    }, [toast]);

    const handleSavePoster = useCallback(async (variant: CertVariant) => {
        if (posterBusyRef.current) return;
        posterBusyRef.current = true;
        try {
            setIsGeneratingPoster(true);
            setPosterError(null);

            const advice = skinTypes.find((item) => item.ipKey === persona)?.m7.suggestions?.slice(0, 2).map((item) => item.title);

            const blob = await renderCertImage({
                persona,
                gender,
                variant,
                score: overallScore,
                percentile,
                sampleSize: percentileSampleSize,
                advice,
                nickname,
                testDate: analyzedAt,
                reportId: sessionId,
            }).catch(async (clientError) => {
                if (!sessionId) throw clientError;
                const res = await fetchWithCsrf(`/api/advisor/reports/${encodeURIComponent(sessionId)}/poster`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ variant, gender: gender === "male" ? "male" : "female" }),
                });
                if (!res.ok) throw clientError;
                return res.blob();
            });

            if (typeof navigator !== "undefined" && isWeChatBrowser(navigator.userAgent)) {
                setPosterSaveIsDesktop(!isMobileDevice(navigator.userAgent, navigator.maxTouchPoints));
                savedPosterTrackedRef.current = false;
                try {
                    setSavedPosterUrl(await blobToDataUrl(blob));
                } catch {
                    setSavedPosterUrl(URL.createObjectURL(blob));
                }
                return;
            }

            const safeName = sanitizeFilename(nickname || "用户");
            const saved = await triggerDownload(blob, `${safeName}的肌智派证书${variant === "noqr" ? "-小红书" : ""}.png`);
            if (saved && !isMock) onShared();
        } catch (error) {
            console.error("证书生成失败:", error);
            setPosterError("证书生成遇到问题，请稍后重试。");
        } finally {
            posterBusyRef.current = false;
            setIsGeneratingPoster(false);
        }
    }, [
        analyzedAt,
        gender,
        isMock,
        nickname,
        onShared,
        overallScore,
        percentile,
        percentileSampleSize,
        persona,
        sessionId,
        setSavedPosterUrl,
        triggerDownload,
    ]);

    const handleRequestSavePoster = useCallback(() => {
        setShowCertVariantPicker(true);
    }, []);

    const handlePickCertVariant = useCallback((variant: CertVariant) => {
        setShowCertVariantPicker(false);
        setCertVariant(variant);
        try { localStorage.setItem(STORAGE_KEYS.ADVISOR_CERT_VARIANT, variant); } catch { /* ignore */ }
        void handleSavePoster(variant);
    }, [handleSavePoster]);

    const closePosterSaveModal = useCallback(() => {
        setSavedPosterUrl(null);
    }, [setSavedPosterUrl]);

    const closeCertVariantPicker = useCallback(() => {
        setShowCertVariantPicker(false);
    }, []);

    const markPosterSaved = useCallback(() => {
        if (isMock || savedPosterTrackedRef.current) return;
        savedPosterTrackedRef.current = true;
        onShared();
    }, [isMock, onShared]);

    return {
        isGeneratingPoster,
        posterError,
        clearPosterError: () => setPosterError(null),
        savedPosterForSave,
        posterSaveIsDesktop,
        certVariant,
        showCertVariantPicker,
        shouldRenderCertVariantPicker,
        handleRequestSavePoster,
        handlePickCertVariant,
        closePosterSaveModal,
        closeCertVariantPicker,
        markPosterSaved,
    };
}
