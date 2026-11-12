/**
 * 服务端证书海报合成（sharp + SVG 文字叠加）。
 *
 * 与客户端 cert-image.ts 共用同一套底图与坐标：
 * - H5 端侧 canvas 为主，失败时回退本接口；
 * - 小程序端侧 canvas 为主，失败时回退本接口；
 * - 后续也可切换到服务端统一出图。
 *
 * 注意：Alpine 运行镜像需要中文字体（Dockerfile 已安装 font-noto-cjk）。
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const CERT_WIDTH = 1440;
const CERT_HEIGHT = 1920;
const TEXT_COLOR = "#324F63";
const FONT_FAMILY = "Noto Sans SC, Microsoft YaHei, PingFang SC, sans-serif";

const VALID_PERSONAS = new Set([
    "sensitive", "minimalist", "luxury", "ageless",
    "desert", "oily", "combination", "guardian",
]);

export type PosterVariant = "qr" | "noqr";

export interface ReportPosterInput {
    persona: string;
    gender: string;
    variant?: PosterVariant;
    nickname?: string;
    score?: number;
    percentile?: number | null;
    sampleSize?: number;
    testDate?: string;
    reportId?: string;
    advice?: string[];
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function fitText(value: string, maxChars: number): string {
    const trimmed = value.trim();
    return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
}

function formatDate(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function shortReportId(value?: string): string | null {
    if (!value) return null;
    const compact = value.replace(/[^a-zA-Z0-9]/g, "");
    return compact ? compact.slice(-8).toUpperCase() : null;
}

function footerLines(input: ReportPosterInput): string[] {
    const lines = ["AI 图像分析，仅供参考，不构成医疗诊断"];
    const meta: string[] = [];
    const date = formatDate(input.testDate);
    const reportId = shortReportId(input.reportId);
    if (date) meta.push(`测肤日期 ${date}`);
    if (reportId) meta.push(`报告编号 ${reportId}`);
    if (typeof input.percentile === "number" && typeof input.sampleSize === "number" && input.sampleSize > 0) {
        meta.push(`样本 ${input.sampleSize} 位用户`);
    }
    if (meta.length > 0) lines.push(meta.join(" · "));
    if (typeof input.percentile === "number" && input.percentile < 40) {
        lines.push("肌肤状态会随作息、换季和激素波动变化，本次评分作为护理起点，建议 4 周后复测对比");
    }
    return lines;
}

function text(x: number, y: number, value: string, options: {
    size: number;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    opacity?: number;
}): string {
    return `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${options.size}" font-weight="${options.weight ?? 400}" text-anchor="${options.anchor ?? "start"}" fill="${TEXT_COLOR}" opacity="${options.opacity ?? 1}">${escapeXml(value)}</text>`;
}

function buildOverlaySvg(input: ReportPosterInput): string {
    const variant = input.variant ?? "qr";
    const parts: string[] = [];

    if (input.nickname?.trim()) {
        const nickname = `${input.nickname.trim()}的肌智派系是：`;
        if (variant === "noqr") {
            parts.push(text(207, 420, fitText(nickname, 16), { size: 36 }));
        } else {
            parts.push(text(88, 290, fitText(nickname, 18), { size: 36 }));
        }
    }

    if (typeof input.score === "number" && Number.isFinite(input.score) && variant === "qr") {
        parts.push(text(282, 1305, String(Math.round(input.score)), { size: 114, weight: 600, anchor: "middle" }));
    }

    if (typeof input.percentile === "number" && Number.isFinite(input.percentile)) {
        if (variant === "noqr") {
            parts.push(text(395, 995, `${input.percentile}%`, { size: 54, weight: 600, anchor: "middle" }));
        } else {
            parts.push(text(565, 1155, `${input.percentile}%`, { size: 54, weight: 600, anchor: "middle" }));
        }
    }

    const advice = (input.advice ?? []).filter((item) => typeof item === "string" && item.trim()).slice(0, 2);
    if (advice.length > 0) {
        if (variant === "noqr") {
            const wrapped = advice.flatMap((line) => {
                const chunks: string[] = [];
                let current = "";
                for (const char of line.trim()) {
                    if (current.length >= 13) {
                        chunks.push(current);
                        current = char;
                    } else {
                        current += char;
                    }
                }
                if (current) chunks.push(current);
                return chunks;
            }).slice(0, 4);
            wrapped.forEach((line, index) => {
                parts.push(text(222, 1430 + index * 34, line, { size: 24 }));
            });
        } else {
            advice.forEach((line, index) => {
                parts.push(text(90, 700 + index * 44, fitText(line, 20), { size: 30 }));
            });
        }
    }

    const footer = footerLines(input);
    const startY = footer.length >= 3 ? 1796 : 1812;
    footer.forEach((line, index) => {
        parts.push(text(88, startY + index * 32, fitText(line, 62), { size: 20, opacity: 0.58 }));
    });

    return `<svg width="${CERT_WIDTH}" height="${CERT_HEIGHT}" viewBox="0 0 ${CERT_WIDTH} ${CERT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

function backgroundPath(persona: string, gender: string, variant: PosterVariant): string {
    const safePersona = VALID_PERSONAS.has(persona) ? persona : "guardian";
    const safeGender = gender === "male" ? "male" : "female";
    const dir = variant === "noqr" ? "cert-noqr" : "cert";
    return path.join(process.cwd(), "public", "images", dir, `${safePersona}_${safeGender}.webp`);
}

export async function renderReportPoster(input: ReportPosterInput): Promise<Buffer> {
    const variant = input.variant ?? "qr";
    const bgPath = backgroundPath(input.persona, input.gender, variant);
    const background = await fs.readFile(bgPath);
    const svg = Buffer.from(buildOverlaySvg({ ...input, variant }));
    return sharp(background)
        .resize(CERT_WIDTH, CERT_HEIGHT, { fit: "fill" })
        .composite([{ input: svg }])
        .png()
        .toBuffer();
}
