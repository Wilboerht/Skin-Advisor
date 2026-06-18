"use client";

import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface PromotionPosterProps {
    skinScore: number;
    percentile: number;
    userImage?: string; // Optional user image
}

export function PromotionPoster({ skinScore, percentile, userImage }: PromotionPosterProps) {
    const posterRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
    const toast = useToast();

    // Generate poster on mount or when data changes
    useEffect(() => {
        const generate = async () => {
            if (!posterRef.current) return;

            try {
                // Wait for images to load if any
                await new Promise(r => setTimeout(r, 500));

                const canvas = await html2canvas(posterRef.current, {
                    useCORS: true,
                    scale: 2, // High resolution
                    backgroundColor: "#fff",
                });

                setPosterDataUrl(canvas.toDataURL("image/png"));
            } catch (error) {
                console.error("Poster generation failed:", error);
            }
        };

        generate();
    }, [skinScore, percentile, userImage]);

    const handleDownload = () => {
        if (!posterDataUrl) return;

        const link = document.createElement("a");
        link.href = posterDataUrl;
        link.download = `nihplod-skin-report-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("海报已保存到相册");
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {/* The actual visible poster preview (generated image) */}
            {posterDataUrl ? (
                <div className="relative overflow-hidden rounded-xl shadow-lg w-full max-w-[300px]">
                    <img src={posterDataUrl} alt="Skin Report Poster" className="w-full h-auto" />
                    <button
                        onClick={handleDownload}
                        className="absolute bottom-4 right-4 h-10 w-10 flex items-center justify-center bg-white rounded-full shadow-md text-brand-gold hover:scale-105 transition-transform"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-[300px] aspect-[3/4] flex items-center justify-center bg-gray-100 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            )}

            {/* Hidden DOM element used for generation */}
            <div
                style={{
                    position: "absolute",
                    top: "-9999px",
                    left: "-9999px",
                    width: "375px", // Standard mobile width
                    height: "600px"
                }}
            >
                <div
                    ref={posterRef}
                    className="w-[375px] h-[600px] bg-[#F0EDE1] relative flex flex-col overflow-hidden font-serif"
                >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-30"
                        style={{ backgroundImage: "radial-gradient(#1B3A5C 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                    />

                    {/* Header */}
                    <div className="p-6 text-center z-10">
                        <div className="inline-block px-3 py-1 border border-[#1B3A5C] rounded-full text-[10px] tracking-widest text-[#1B3A5C] mb-4">
                            NIHPLOD SKIN LAB
                        </div>
                        <h2 className="text-2xl text-[#1A1A1A]">肌肤分析报告</h2>
                        <div className="text-xs text-[#5E5E5E] mt-1 space-x-2">
                            <span>AI智能检测</span>
                            <span>•</span>
                            <span>专家级建议</span>
                        </div>
                    </div>

                    {/* Score Circle */}
                    <div className="flex-1 flex flex-col items-center justify-center -mt-10 z-10">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                            {/* Decorative rings */}
                            <div className="absolute inset-0 border border-[#1B3A5C]/10 rounded-full animate-[spin_10s_linear_infinite]" />
                            <div className="absolute inset-4 border border-[#1B3A5C]/20 rounded-full" />

                            <div className="text-center">
                                <div className="text-6xl font-light text-[#1B3A5C]">{skinScore}</div>
                                <div className="text-xs tracking-widest text-[#1B3A5C]/60 mt-1">SKIN SCORE</div>
                            </div>
                        </div>

                        <div className="mt-6 px-8 text-center">
                            <p className="text-[#1A1A1A] text-sm leading-relaxed">
                                您的肌肤状态超越了 <span className="font-bold border-b border-[#1B3A5C]/30">{percentile}%</span> 的同龄用户。
                                <br />
                                保持当下，焕发新生。
                            </p>
                        </div>
                    </div>

                    {/* Footer / QR Code Placeholder */}
                    <div className="p-6 bg-white/50 backdrop-blur-sm mt-auto z-10 border-t border-[#1B3A5C]/10 flex items-center justify-between">
                        <div className="text-left">
                            <div className="text-lg font-serif text-[#1A1A1A]">NIHPLOD</div>
                            <div className="text-[10px] text-[#5E5E5E]">源自摩纳哥的高端护肤实验室</div>
                        </div>
                        <div className="w-16 h-16 bg-[#1B3A5C] flex items-center justify-center text-white text-[8px] text-center p-1">
                            此处放置<br />小程序码
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
