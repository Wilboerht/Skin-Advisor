"use client";

/**
 * 分享卡片截图和 PDF 生成 Hook
 * PDF 通过服务端 API 生成
 * Adapted for Standalone Version
 */

import { useState, useCallback, useRef, RefObject } from "react";
import html2canvas from "html2canvas";

interface ShareAndPdfOptions {
    shareCardRef: RefObject<HTMLDivElement | null>;
}

interface UseShareAndPdfReturn {
    isImageGenerating: boolean;
    isPdfGenerating: boolean;
    hasShared: boolean;
    canDownloadPdf: boolean;
    generateShareImage: () => Promise<string | null>;
    saveShareCard: () => Promise<boolean>;
    downloadPdf: () => Promise<boolean>;
}

// localStorage key
const SHARE_STATUS_KEY = "nihplod_advisor_shared";

/** 从 localStorage 读取分析结果 */
function getAdvisorResult() {
    if (typeof window === "undefined") return null;
    const resultStr = localStorage.getItem("advisor_result");
    if (!resultStr) return null;
    try {
        return JSON.parse(resultStr);
    } catch {
        return null;
    }
}

/** 从 advisor_result 中提取 faceAnalysis */
function getFaceAnalysis() {
    const result = getAdvisorResult();
    return result?.faceAnalysis || null;
}

/**
 * 等待元素内所有图片加载完成
 */
async function waitForImagesToLoad(element: HTMLElement): Promise<void> {
    const images = element.querySelectorAll("img");
    const promises = Array.from(images).map((img) => {
        if (img.complete && img.naturalHeight !== 0) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => {
                console.warn("Image failed to load:", img.src);
                resolve(); // 即使加载失败也继续
            };
        });
    });
    await Promise.all(promises);
}

export function useShareAndPdf(options: ShareAndPdfOptions): UseShareAndPdfReturn {
    const { shareCardRef } = options;

    const [isImageGenerating, setIsImageGenerating] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [hasShared, setHasShared] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(SHARE_STATUS_KEY) === "true";
    });

    // 使用 ref 追踪 PDF 请求状态，避免重复请求
    const pdfRequestInFlight = useRef(false);

    const canDownloadPdf = hasShared;

    /**
     * 生成分享卡片图片
     */
    const generateShareImage = useCallback(async (): Promise<string | null> => {
        if (!shareCardRef.current) return null;

        try {
            // 等待所有图片加载完成
            await waitForImagesToLoad(shareCardRef.current);

            // 额外等待一小段时间确保渲染完成
            await new Promise((resolve) => setTimeout(resolve, 100));

            const canvas = await html2canvas(shareCardRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: false, // 改为 false，避免污染 canvas
                backgroundColor: "#FAF8F5",
                logging: false,
                imageTimeout: 15000, // 图片加载超时 15 秒
            });

            return canvas.toDataURL("image/png");
        } catch (error) {
            console.error("Failed to generate share image:", error);
            return null;
        }
    }, [shareCardRef]);

    /**
     * 保存分享卡片到相册
     */
    const saveShareCard = useCallback(async (): Promise<boolean> => {
        setIsImageGenerating(true);

        try {
            const imageUrl = await generateShareImage();
            if (!imageUrl) {
                throw new Error("Failed to generate image");
            }

            // 尝试使用 Web Share API（移动端）
            if (navigator.share && navigator.canShare) {
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const file = new File([blob], "nihplod-skin-report.png", { type: "image/png" });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: "NIHPLOD 肌肤分析报告",
                        });
                        // 标记已分享
                        localStorage.setItem(SHARE_STATUS_KEY, "true");
                        setHasShared(true);
                        return true;
                    }
                } catch (shareError) {
                    console.warn("Share API failed:", shareError);
                }
            }

            // 降级到下载
            const link = document.createElement("a");
            link.download = "nihplod-skin-report.png";
            link.href = imageUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 标记已分享
            localStorage.setItem(SHARE_STATUS_KEY, "true");
            setHasShared(true);
            return true;
        } catch (error) {
            console.error("Failed to save share card:", error);
            return false;
        } finally {
            setIsImageGenerating(false);
        }
    }, [generateShareImage]);

    /**
     * 下载 PDF 报告（服务端生成）
     */
    /**
     * 下载 PDF 报告（客户端生成）
     */
    const downloadPdf = useCallback(async (): Promise<boolean> => {
        // 防止重复点击
        if (!shareCardRef.current || isPdfGenerating) return false;

        setIsPdfGenerating(true);

        try {
            // 1. 生成图片
            const imageUrl = await generateShareImage();
            if (!imageUrl) throw new Error("Failed to generate image for PDF");

            // 2. 动态导入 jsPDF
            const { jsPDF } = await import("jspdf");

            // 3. 创建 PDF
            // A4 尺寸: 210mm x 297mm
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const imgProps = pdf.getImageProperties(imageUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // 如果图片高度超过一页，需要分页处理（这里简单处理，缩放适应或单页）
            // 简单策略：单页长图可能被压缩，或者分页。
            // 考虑到是分享卡片，通常长图适应宽度即可，允许翻页

            // 简单实现：将生成的长图添加到 PDF
            // 如果高度超过 A4 (297mm)，则分多页添加
            const pageHeight = pdf.internal.pageSize.getHeight();
            let heightLeft = pdfHeight;
            let position = 0;

            // 第一页
            pdf.addImage(imageUrl, "PNG", 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            // 后续页
            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight; // top margin for next page
                pdf.addPage();
                pdf.addImage(imageUrl, "PNG", 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            // 4. 保存
            pdf.save("NIHPLOD-肌肤分析报告.pdf");

            return true;
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            return false;
        } finally {
            setIsPdfGenerating(false);
        }
    }, [shareCardRef, isPdfGenerating, generateShareImage]);

    return {
        isImageGenerating,
        isPdfGenerating,
        hasShared,
        canDownloadPdf,
        generateShareImage,
        saveShareCard,
        downloadPdf,
    };
}
