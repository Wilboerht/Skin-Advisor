/**
 * 测肤证书下载图合成（客户端 canvas）
 *
 * 底图：8 派 × 男女共 16 张成品证书（1440×1920；派系名、人物形象、logo 等静态元素均已烘焙）：
 * - `qr`    标准版：public/images/cert/       —— 含综合评分夹板 + 静态二维码
 * - `noqr`  分享版：public/images/cert-noqr/  —— 无二维码（小红书 @NIHPLOD 角标），无评分区
 *
 * 这里只叠加动态数据后导出 PNG blob。替代原 html-to-image DOM 截图流程：
 * 无字体/图片加载时序问题，不会出现空白图，也不需要离屏 DOM 与预生成缓存。
 */

export const CERT_IMAGE_WIDTH = 1440;
export const CERT_IMAGE_HEIGHT = 1920;

/** 叠加文字颜色：取样自底图烘焙文字（"击败了全国"等） */
const TEXT_COLOR = "#324F63";
const FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

const VALID_PERSONAS = new Set([
    "sensitive", "minimalist", "luxury", "ageless",
    "desert", "oily", "combination", "guardian",
]);

export type CertVariant = "qr" | "noqr";

export interface CertImageInput {
    /** 8 派 IP key（matchCharacterIP 的 key）；非法值回退 guardian（守护派兜底图必然存在） */
    persona: string;
    /** male/female；其它值回退 female */
    gender: string;
    /** 标准版（含二维码）/ 分享版（无二维码），缺省 qr */
    variant?: CertVariant;
    /** 综合评分（仅 qr 版有评分区）；缺省不叠加（底图留空） */
    score?: number;
    /** 百分位（击败了全国 X% 的用户）；null/缺省不叠加 */
    percentile?: number | null;
    /** 派系建议（m7 建议标题），最多叠加 2 条 */
    advice?: string[];
    /** 用户昵称：在「肌智派自测证书」标题下方叠加一行"{昵称}的肌智派系是：" */
    nickname?: string;
}

export function certImageUrl(persona: string, gender: string, variant: CertVariant = "qr"): string {
    const p = VALID_PERSONAS.has(persona) ? persona : "guardian";
    const g = gender === "male" ? "male" : "female";
    return variant === "noqr" ? `/images/cert-noqr/${p}_${g}.webp` : `/images/cert/${p}_${g}.webp`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`证书底图加载失败: ${url}`));
        img.src = url;
    });
}

/** 超宽文本截断加省略号（canvas maxWidth 是横向挤压而不是截断，观感差，手动处理） */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
        t = t.slice(0, -1);
    }
    return t + "…";
}

/** 按字符贪心换行（中文无空格，逐字断行即可）；返回行数组 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const ch of text) {
        if (line && ctx.measureText(line + ch).width > maxWidth) {
            lines.push(line);
            line = ch;
        } else {
            line += ch;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/** qr 版：标题下叠加昵称行；夹板留空区叠加评分 + 圆环叠加百分位 + 护肤建议（每条一行） */
function drawQrOverlays(ctx: CanvasRenderingContext2D, input: CertImageInput): void {
    if (input.nickname?.trim()) {
        ctx.font = `36px ${FONT_STACK}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(fitText(ctx, `${input.nickname.trim()}的肌智派系是：`, 550), 88, 290);
    }
    if (typeof input.score === "number" && Number.isFinite(input.score)) {
        ctx.font = `600 114px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(String(Math.round(input.score)), 282, 1305);
    }
    if (typeof input.percentile === "number" && Number.isFinite(input.percentile)) {
        ctx.font = `600 54px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`${input.percentile}%`, 565, 1155);
    }
    const adviceLines = (input.advice ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 2);
    if (adviceLines.length > 0) {
        ctx.font = `30px ${FONT_STACK}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        adviceLines.forEach((line, i) => {
            ctx.fillText(fitText(ctx, line.trim(), 500), 90, 700 + i * 44);
        });
    }
}

/** noqr 版：标题下叠加昵称行；左侧圆环叠加百分位；护肤建议区纵向空间有限（约 140px），逐字换行、最多 4 行 */
function drawNoqrOverlays(ctx: CanvasRenderingContext2D, input: CertImageInput): void {
    if (input.nickname?.trim()) {
        ctx.font = `36px ${FONT_STACK}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(fitText(ctx, `${input.nickname.trim()}的肌智派系是：`, 500), 207, 420);
    }
    if (typeof input.percentile === "number" && Number.isFinite(input.percentile)) {
        ctx.font = `600 54px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`${input.percentile}%`, 395, 995);
    }
    const adviceLines = (input.advice ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 2);
    if (adviceLines.length > 0) {
        ctx.font = `24px ${FONT_STACK}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        const wrapped = adviceLines.flatMap((line) => wrapText(ctx, line.trim(), 330));
        const MAX_LINES = 4;
        const overflow = wrapped.length > MAX_LINES;
        const shown = wrapped.slice(0, MAX_LINES);
        if (overflow) shown[MAX_LINES - 1] = fitText(ctx, shown[MAX_LINES - 1] + "…", 330);
        shown.forEach((line, i) => {
            ctx.fillText(line, 222, 1430 + i * 34);
        });
    }
}

export async function renderCertImage(input: CertImageInput): Promise<Blob> {
    const variant = input.variant ?? "qr";
    const img = await loadImage(certImageUrl(input.persona, input.gender, variant));

    const canvas = document.createElement("canvas");
    canvas.width = CERT_IMAGE_WIDTH;
    canvas.height = CERT_IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d 上下文不可用");
    ctx.drawImage(img, 0, 0, CERT_IMAGE_WIDTH, CERT_IMAGE_HEIGHT);

    ctx.fillStyle = TEXT_COLOR;
    if (variant === "noqr") drawNoqrOverlays(ctx, input);
    else drawQrOverlays(ctx, input);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("证书图片导出失败"));
        }, "image/png");
    });
}
