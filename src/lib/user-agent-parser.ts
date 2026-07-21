/**
 * 用户代理(User-Agent)解析工具
 * 提供统一的设备类型、浏览器、操作系统检测
 */
export interface DeviceInfo {
    deviceType: string | null;
    browser: string | null;
    os: string | null;
}

export function parseUserAgent(userAgent: string | null): DeviceInfo {
    if (!userAgent) return { deviceType: null, browser: null, os: null };

    const ua = userAgent.toLowerCase();

    let deviceType: string | null = 'desktop';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(userAgent)) {
        deviceType = 'mobile';
    }

    let browser: string | null = 'unknown';
    if (ua.includes('firefox')) browser = 'firefox';
    else if (ua.includes('edg')) browser = 'edge';
    else if (ua.includes('chrome')) browser = 'chrome';
    else if (ua.includes('safari')) browser = 'safari';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'opera';

    let os: string | null = 'unknown';
    if (ua.includes('win')) os = 'windows';
    else if (ua.includes('mac')) os = 'macos';
    else if (ua.includes('linux')) os = 'linux';
    else if (ua.includes('android')) os = 'android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios';

    return { deviceType, browser, os };
}
