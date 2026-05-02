import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getSession } from "@/lib/auth";

// 缓存资源
let cachedFontBase64: string | null = null;
let cachedLogoBase64: string | null = null;
let cachedQrcodeBase64: string | null = null;
let jsPDFModule: typeof import("jspdf") | null = null;
let sharpModule: typeof import("sharp") | null = null;

async function loadResources() {
    if (!jsPDFModule) jsPDFModule = await import("jspdf");

    if (!cachedFontBase64) {
        const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf");
        if (fs.existsSync(fontPath)) {
            cachedFontBase64 = fs.readFileSync(fontPath).toString("base64");
        } else {
            console.warn("Font file missing:", fontPath);
        }
    }

    if (!cachedLogoBase64) {
        const logoPath = path.join(process.cwd(), "public", "images", "NIHPLOD-logo.svg");
        if (fs.existsSync(logoPath)) {
            if (!sharpModule) sharpModule = (await import("sharp")).default;
            const svgBuffer = fs.readFileSync(logoPath);
            const pngBuffer = await sharpModule(svgBuffer)
                .png()
                .toBuffer();
            cachedLogoBase64 = pngBuffer.toString("base64");
        }
    }

    if (!cachedQrcodeBase64) {
        const qrPath = path.join(process.cwd(), "public", "images", "qrcode.png");
        if (fs.existsSync(qrPath)) cachedQrcodeBase64 = fs.readFileSync(qrPath).toString("base64");
    }

    return {
        jsPDF: jsPDFModule.jsPDF,
        fontBase64: cachedFontBase64,
        logoBase64: cachedLogoBase64,
        qrcodeBase64: cachedQrcodeBase64
    };
}

// 辅助：Hex 转 RGB
const rgb = (hex: string): [number, number, number] => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
};

import { resolveIPLocation } from "@/lib/geoip";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        let { skinProfile, analysis, faceAnalysis, userImage, location, bioFactors } = body;

        // Auto-detect location if missing
        if (!location || (!location.province && !location.city)) {
            const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
            const geo = resolveIPLocation(ip);
            if (geo) {
                location = {
                    province: geo.region,
                    city: geo.city
                };
            }
        }

        const { jsPDF, fontBase64, logoBase64, qrcodeBase64 } = await loadResources();

        // 初始化 A4 文档
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = 210, pageHeight = 297, marginX = 25, marginTop = 20;
        let y = marginTop;

        // 注册字体
        if (fontBase64) {
            doc.addFileToVFS("NotoSansSC.ttf", fontBase64);
            doc.addFont("NotoSansSC.ttf", "NotoSansSC", "normal");
            doc.setFont("NotoSansSC", "normal");
        }

        // 颜色
        const gold = "#C8AA6E", dark = "#333333", gray = "#666666", lightGray = "#999999";

        // 辅助函数
        const newPage = () => { doc.addPage(); y = marginTop; drawHeader(); };
        const ensureSpace = (h: number) => { if (y + h > pageHeight - 20) newPage(); };

        const drawHeader = () => {
            if (logoBase64) {
                try {
                    // Logo 简单的保持长宽比
                    doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", marginX, 12, 22, 7);
                } catch (e) { }
            }
            doc.setFontSize(8);
            doc.setTextColor(...rgb(lightGray));
            const dateStr = new Date().toLocaleDateString("zh-CN");
            doc.text(dateStr, pageWidth - marginX, 17, { align: "right" });
            doc.setDrawColor(...rgb(gold));
            doc.setLineWidth(0.4);
            doc.line(marginX, 22, pageWidth - marginX, 22);
            y = 35;
        };

        const drawSection = (title: string) => {
            ensureSpace(20);
            if (y > 35) y += 5; // spacing
            doc.setDrawColor(...rgb(gold));
            doc.setLineWidth(0.6);
            doc.line(marginX, y - 4, marginX, y + 2);
            doc.setFontSize(13);
            doc.setTextColor(...rgb(dark));
            doc.text(title, marginX + 5, y);
            y += 8;
        };

        // --- 封面 ---
        doc.setFillColor(250, 248, 245);
        doc.rect(0, 0, pageWidth, pageHeight, "F"); // bg

        if (logoBase64) {
            try {
                // Center Logo
                doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", pageWidth / 2 - 25, 75, 50, 16);
            } catch (e) { }
        }

        doc.setFontSize(32);
        doc.setTextColor(...rgb(dark));
        doc.text("肌肤分析报告", pageWidth / 2, 120, { align: "center" });

        doc.setFontSize(18);
        doc.setTextColor(...rgb(gold));
        const skinTypeLabel = skinProfile?.typeLabel || "未知肤质";
        doc.text(skinTypeLabel, pageWidth / 2, 140, { align: "center" });

        if (faceAnalysis?.overallScore) {
            doc.setFontSize(40);
            doc.setTextColor(...rgb(dark));
            doc.text(String(faceAnalysis.overallScore), pageWidth / 2, 180, { align: "center" });
            doc.setFontSize(10);
            doc.text("综合评分", pageWidth / 2, 190, { align: "center" });
        }

        doc.setFontSize(10);
        doc.setTextColor(...rgb(gray));
        doc.text("NIHPLOD AI 智能护肤顾问", pageWidth / 2, pageHeight - 30, { align: "center" });

        // --- 内容页 1 ---
        newPage(); // Start content page with header

        // 1. 基本信息
        drawSection("一、基本信息");
        doc.setFontSize(10);
        doc.setTextColor(...rgb(dark));

        const info = [
            `肤质类型：${skinTypeLabel}`,
            `肌肤年龄：${skinProfile?.skinAge || faceAnalysis?.skinAge?.estimated || '--'} 岁`,
            `水分状态：${faceAnalysis?.hydration?.level || '正常'}`,
            `关注问题：${skinProfile?.concerns?.join('、') || '无'}`
        ];

        info.forEach(line => {
            doc.text(line, marginX, y);
            y += 6;
        });

        // 2. 详细分析
        if (analysis?.summary) {
            drawSection("二、综合分析");
            doc.setFontSize(10);
            doc.setTextColor(...rgb(dark));
            const lines = doc.splitTextToSize(analysis.summary, pageWidth - marginX * 2);
            lines.forEach((line: string) => {
                ensureSpace(6);
                doc.text(line, marginX, y);
                y += 6;
            });
        }

        if (faceAnalysis?.dimensions) {
            drawSection("三、面部维度分析");
            const dims = faceAnalysis.dimensions;
            const labels: Record<string, string> = {
                spots: "色斑", wrinkles: "皱纹", texture: "纹理",
                uvDamage: "光损伤", brownSpots: "棕色斑", redAreas: "红色区", acneRisk: "紫质"
            };
            const gradeLabels: Record<string, string> = {
                excellent: "优秀", good: "良好", average: "一般", fair: "需关注", poor: "需改善"
            };

            Object.entries(dims).forEach(([key, val]: [string, any]) => {
                ensureSpace(6);
                const name = labels[key] || key;
                const gradeText = gradeLabels[val.grade] || val.grade || "";

                doc.setFontSize(10);
                // 显示格式: 色斑: 75分 (良好) - 详细描述
                const text = `${name}: ${val.score}分 ${gradeText ? `(${gradeText})` : ""} - ${val.details || ""}`;
                doc.text(text, marginX, y);
                y += 6;
            });
        }

        // --- 尾页 (二维码) ---
        // Optional: append disclaimer
        ensureSpace(30);
        doc.setFontSize(8);
        doc.setTextColor(...rgb(lightGray));
        const disclaimer = "免责声明：本报告由 AI 生成，仅供参考，不构成医疗建议。";
        doc.text(disclaimer, marginX, pageHeight - 20);

        if (qrcodeBase64) {
            try {
                // Bottom right QR
                doc.addImage(`data:image/png;base64,${qrcodeBase64}`, "PNG", pageWidth - marginX - 20, pageHeight - 40, 20, 20);
            } catch (e) { }
        }

        // --- 页码 & 页脚装饰 ---
        const pageCount = doc.getNumberOfPages();
        for (let i = 2; i <= pageCount; i++) {
            doc.setPage(i);

            // Footer Line
            doc.setDrawColor(...rgb(gold));
            doc.setLineWidth(0.4);
            doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);

            // Footer Text
            doc.setFontSize(8);
            doc.setTextColor(...rgb(lightGray));

            // Left: Branding
            doc.text("NIHPLOD.CN", marginX, pageHeight - 10);

            // Center: Page Number
            doc.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth / 2, pageHeight - 10, { align: "center" });

            // Right: UUID or Code (Optional)
            // doc.text(sessionId || "", pageWidth - marginX, pageHeight - 10, { align: "right" });
        }

        // Output
        const pdfBuffer = doc.output("arraybuffer");
        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="NIHPLOD-Skin-Report.pdf"`,
            }
        });

    } catch (error) {
        console.error("PDF Gen Error:", error);
        return NextResponse.json({ error: "生成 PDF 失败" }, { status: 500 });
    }
}
