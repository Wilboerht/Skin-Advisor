/**
 * 测肤证书下载图合成（客户端 canvas）
 *
 * 底图：public/images/cert/{persona}_{gender}.webp —— 8 派 × 男女共 16 张成品证书
 * （1440×1920；派系名、人物形象、logo、底部活动卡与静态二维码均已烘焙进图）。
 * 这里只叠加动态数据：综合评分、百分位、派系建议，然后导出 PNG blob。
 *
 * 替代原 html-to-image DOM 截图流程：无字体/图片加载时序问题，不会截出空白图，
 * 也不需要离屏 DOM 与预生成缓存。
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

export interface CertImageInput {
    /** 8 派 IP key（matchCharacterIP 的 key）；非法值回退 guardian（守护派兜底图必然存在） */
    persona: string;
    /** male/female；其它值回退 female */
    gender: string;
    /** 综合评分；缺省不叠加（底图留空） */
    score?: number;
    /** 百分位（击败了全国 X% 的用户）；null/缺省不叠加 */
    percentile?: number | null;
    /** 派系建议（m7 建议标题），最多叠加 2 条，每条一行 */
    advice?: string[];
}

export function certImageUrl(persona: string, gender: string): string {
    const p = VALID_PERSONAS.has(persona) ? persona : "guardian";
    const g = gender === "male" ? "male" : "female";
    return `/images/cert/${p}_${g}.webp`;
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

export async function renderCertImage(input: CertImageInput): Promise<Blob> {
    const img = await loadImage(certImageUrl(input.persona, input.gender));

    const canvas = document.createElement("canvas");
    canvas.width = CERT_IMAGE_WIDTH;
    canvas.height = CERT_IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d 上下文不可用");
    ctx.drawImage(img, 0, 0, CERT_IMAGE_WIDTH, CERT_IMAGE_HEIGHT);

    ctx.fillStyle = TEXT_COLOR;

    // 综合评分：夹板「综合评分 SKIN SCORE」标签正下方留空区（坐标在 1440×1920 下实测对齐）
    if (typeof input.score === "number" && Number.isFinite(input.score)) {
        ctx.font = `600 114px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(String(Math.round(input.score)), 282, 1305);
    }

    // 百分位：圆环「击败了全国 / 的用户」之间留空区
    if (typeof input.percentile === "number" && Number.isFinite(input.percentile)) {
        ctx.font = `600 54px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`${input.percentile}%`, 565, 1155);
    }

    // 派系建议：左上「护肤建议 SKIN CARE ADVICE」标签下方留空区，最多 2 条、每条一行
    const adviceLines = (input.advice ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 2);
    if (adviceLines.length > 0) {
        ctx.font = `30px ${FONT_STACK}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        adviceLines.forEach((line, i) => {
            ctx.fillText(fitText(ctx, line.trim(), 500), 90, 700 + i * 44);
        });
    }

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("证书图片导出失败"));
        }, "image/png");
    });
}
