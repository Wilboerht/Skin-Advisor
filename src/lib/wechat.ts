/**
 * 微信公众号服务封装 - 处理模板消息推送等核心逻辑
 */

// 这是一个简化的内存缓存。如果在生产（多个 Serverless 函数实例并发）环境下，
// 最佳实践应该是存到 Redis 或者你的 PostgreSQL 里的 Setting 表里。
// 这里先用一个简单的全局变量方案展示核心逻辑。
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * 核心方法：获取有效的微信 AccessToken
 */
export async function getWechatAccessToken(): Promise<string | null> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
        console.error("缺少微信服务凭据，无法获取 AccessToken");
        return null;
    }

    // 检查内存中是否有还没过期的 Token
    if (cachedAccessToken && Date.now() < tokenExpiresAt) {
        return cachedAccessToken;
    }

    try {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (data.access_token) {
            cachedAccessToken = data.access_token;
            // 微信返回的 expires_in 一般是 7200 秒，我们提前 5 分钟(300秒)判定过期以防万一
            tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
            return cachedAccessToken;
        } else {
            console.error("获取微信 AccessToken 失败:", data);
            return null;
        }
    } catch (error) {
        console.error("获取微信 AccessToken 发生异常:", error);
        return null;
    }
}

/**
 * 推送“护肤检测报告生成”的模板消息
 * 
 * @param openId 目标用户的微信 OpenID
 * @param sessionData 需要填充的数据（如分数、问题点）
 * @param reportUrl 用户点击后跳转到的精美报告网页 URL
 */
export async function sendSkinReportTemplateMessage(
    openId: string,
    sessionData: {
        score: number | string;
        primaryConcern: string;
    },
    reportUrl: string
): Promise<boolean> {
    const token = await getWechatAccessToken();
    const templateId = process.env.WECHAT_TEMPLATE_ID;

    if (!token || !templateId) {
        console.warn("无法发送微信模板消息，缺少 Token 或 Template ID 配置");
        return false;
    }

    // 组装要发送的载荷
    const payload = {
        touser: openId,
        template_id: templateId,
        url: reportUrl,
        topcolor: "#171717",
        data: {
            result: {
                value: "深度面部分析已完成",
                color: "#171717",
            },
            score: {
                value: sessionData.score.toString(),
                color: "#d97706", // 分数给个高亮橘黄色
            },
            concern: {
                value: sessionData.primaryConcern,
                color: "#dc2626", // 主要问题给个警示红色
            },
            time: {
                value: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
                color: "#6b7280",
            },
            remark: {
                value: "👉 点击本卡片立即查看您的详细数字分析大屏及抗老护肤建议。",
                color: "#059669",
            },
        },
    };

    try {
        const response = await fetch(
            `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();

        if (data.errcode === 0) {
            console.log(`✅ 成功发送模板消息给用户: ${openId}`);
            return true;
        } else {
            console.error(`❌ 发送微信模板消息失败: ${data.errmsg} (${data.errcode})`);
            return false;
        }
    } catch (error) {
        console.error("推送信模板消息时发生异常:", error);
        return false;
    }
}
