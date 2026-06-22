/**
 * 分享与保存工具
 */

import html2canvas from "html2canvas";

/** 分享平台 */
export type SharePlatform = "wechat" | "weibo" | "copy" | "native" | "xiaohongshu" | "douyin";

/** 分享数据 */
export interface ShareData {
    title: string;
    description: string;
    url: string;
    image?: string;
}

/**
 * 将元素转换为图片
 * 用于截图已渲染的固定宽度元素
 */
export async function elementToImage(
    element: HTMLElement,
    options?: {
        scale?: number;
        backgroundColor?: string;
    }
): Promise<string> {
    const { scale = 2, backgroundColor = "#FAF8F5" } = options || {};

    const canvas = await html2canvas(element, {
        scale,
        backgroundColor,
        useCORS: true,
        allowTaint: true,
        logging: false,
    });

    return canvas.toDataURL("image/png", 1.0);
}

/**
 * 下载图片到本地
 */
export function downloadImage(dataUrl: string, filename: string = "nihplod-skin-report.png"): void {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 保存到相册（移动端尝试触发保存）
 */
export async function saveToGallery(dataUrl: string): Promise<boolean> {
    // 检查是否支持 Web Share API（移动端）
    if (navigator.share && navigator.canShare) {
        try {
            // 将 data URL 转换为 Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], "nihplod-skin-report.png", { type: "image/png" });

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "NIHPLOD 肌肤分析报告",
                });
                return true;
            }
        } catch (error) {
            console.warn("Share API failed:", error);
        }
    }

    // 降级到下载
    downloadImage(dataUrl);
    return true;
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // 降级方案
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * 生成分享链接
 */
export function generateShareUrl(baseUrl: string, params?: Record<string, string>): string {
    const url = new URL(baseUrl, window.location.origin);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
    }

    // 添加分享标记
    url.searchParams.set("shared", "1");

    return url.toString();
}

/**
 * 调用微博分享
 */
export function shareToWeibo(data: ShareData): void {
    const params = new URLSearchParams({
        url: data.url,
        title: `${data.title} - ${data.description}`,
    });

    if (data.image) {
        params.set("pic", data.image);
    }

    const weiboUrl = `https://service.weibo.com/share/share.php?${params.toString()}`;
    window.open(weiboUrl, "_blank", "width=600,height=500,noopener=yes,noreferrer=yes");
}

/**
 * 调用微信分享（显示二维码提示）
 */
export function shareToWechat(data: ShareData): { url: string; showQRHint: boolean } {
    // 微信分享需要在微信内打开，或者显示二维码让用户扫描
    // 这里返回分享链接和提示信息
    return {
        url: data.url,
        showQRHint: true,
    };
}

/**
 * 使用原生分享 API
 */
export async function shareNative(data: ShareData): Promise<boolean> {
    if (!navigator.share) {
        return false;
    }

    try {
        await navigator.share({
            title: data.title,
            text: data.description,
            url: data.url,
        });
        return true;
    } catch (error) {
        // 用户取消分享不算错误
        if ((error as Error).name === "AbortError") {
            return false;
        }
        throw error;
    }
}

/**
 * 分享数据（扩展版）
 */
export interface ExtendedShareData extends ShareData {
    skinTypeLabel?: string;
    score?: number;
}

/**
 * 调用小红书分享（复制文案到剪贴板）
 * 小红书无 Web 分享 API，采用"保存图片 + 复制文案"的引导方案
 */
export async function shareToXiaohongshu(data: ExtendedShareData): Promise<{ text: string; url: string }> {
    const { title, description } = generateXiaohongshuText(data.skinTypeLabel, data.score);
    const fullText = `${title}\n\n${description}\n\n${data.url}`;
    await copyToClipboard(fullText);
    return { text: fullText, url: data.url };
}

/**
 * 调用抖音分享（复制文案到剪贴板）
 * 抖音无 Web 分享 API，采用"保存图片 + 复制文案"的引导方案
 */
export async function shareToDouyin(data: ExtendedShareData): Promise<{ text: string; url: string }> {
    const { title, description } = generateDouyinText(data.skinTypeLabel, data.score);
    const fullText = `${title}\n\n${description}\n\n${data.url}`;
    await copyToClipboard(fullText);
    return { text: fullText, url: data.url };
}

/**
 * 统一分享入口
 */
export async function share(platform: SharePlatform, data: ExtendedShareData): Promise<boolean> {
    switch (platform) {
        case "native":
            return shareNative(data);

        case "weibo":
            shareToWeibo(data);
            return true;

        case "wechat": {
            // 微信分享需要特殊处理
            const wechatResult = shareToWechat(data);
            if (wechatResult.showQRHint) {
                // 复制链接并提示用户
                await copyToClipboard(wechatResult.url);
            }
            return true;
        }

        case "xiaohongshu":
            await shareToXiaohongshu(data);
            return true;

        case "douyin":
            await shareToDouyin(data);
            return true;

        case "copy":
            return copyToClipboard(
                `${data.title}\n${data.description}\n\n${data.url}`
            );

        default:
            return false;
    }
}

/**
 * 检测分享能力
 */
export function getShareCapabilities(): {
    native: boolean;
    clipboard: boolean;
    download: boolean;
} {
    return {
        native: typeof navigator !== "undefined" && !!navigator.share,
        clipboard: typeof navigator !== "undefined" && !!navigator.clipboard,
        download: true, // 下载始终可用
    };
}

/**
 * 生成分享文案
 * 不暴露用户具体肌肤问题，使用正向引导语
 */
/**
 * 生成分享文案
 * 不暴露用户具体肌肤问题，使用正向引导语
 */
export function generateShareText(
    skinType?: string,
    concerns?: string[]
): { title: string; description: string } {
    const skinTypeLabel = skinType || "神秘肤质";
    const concernCount = concerns?.length || 0;

    // 随机选择一条分享文案，保持新鲜感
    const shareTemplates = [
        {
            title: `我是【${skinTypeLabel}】，已解锁专属护肤攻略 ✨`,
            description: "NIHPLOD AI 护肤顾问帮我定制了全套方案，结果很惊喜！推荐你也来试试～",
        },
        {
            title: "这个 AI 护肤测试也太准了吧！",
            description: `一键分析出了${concernCount > 0 ? concernCount + '个' : '我的'}肌肤重点，还推荐了适合的成分，免费的快来！`,
        },
        {
            title: "姐妹们快来测肌肤状态 🌸",
            description: "NIHPLOD 的 AI 护肤顾问，测完才知道盲目护肤走了多少弯路！",
        },
        {
            title: "终于知道自己适合什么护肤品了",
            description: "专业 AI 分析 + 定制化护肤步骤，这个宝藏工具必须分享！",
        },
        {
            title: "沉浸式护肤打卡 ✅",
            description: "根据 AI 建议调整了护肤流程，感觉皮肤状态越来越好了！",
        }
    ];

    const template = shareTemplates[Math.floor(Math.random() * shareTemplates.length)];
    return template;
}

/**
 * 生成小红书专用文案
 */
export function generateXiaohongshuText(
    skinTypeLabel?: string,
    skinScore?: number
): { title: string; description: string } {
    const scoreText = skinScore ? `肌肤评测得分：${skinScore}分！` : "测完太意外了！";
    const typeText = skinTypeLabel ? `我是【${skinTypeLabel}】` : "";

    return {
        title: "这个 AI 测肤也太准了吧！😭 " + scoreText,
        description: `答应我！姐妹们一定要去测！
${typeText} 
测完立马get专属护肤方案，连护肤步骤都安排明白了✅
完全免费！不用下载 APP！
👇点击下方链接直达测评
#护肤 #AI测肤 #NIHPLOD #护肤日常 #精准护肤`,
    };
}

/**
 * 生成抖音专用文案
 */
/**
 * 生成抖音专用文案
 */
export function generateDouyinText(
    skinTypeLabel?: string,
    skinScore?: number
): { title: string; description: string } {
    const scoreText = skinScore ? `🔥我的肌肤得分：${skinScore}！你的呢？` : "🔥全网都在测的AI护肤顾问！";

    return {
        title: scoreText,
        description: `NIHPLOD 智能 AI 测肤，一键分析肤质问题。
${skinTypeLabel ? `原来我是👉${skinTypeLabel}，` : ""}怪不得之前的护肤品都用错了！
AI 定制的护肤方案真的绝👍，快艾特你的闺蜜一起来测！👯‍♀️
#ai测肤 #沉浸式护肤 #护肤干货 #我的变美日记 #NIHPLOD`,
    };
}
