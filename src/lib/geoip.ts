

export interface GeoLocation {
    country?: string;
    region?: string; // Province code usually, e.g. "SH"
    city?: string;
    ll?: [number, number]; // Latitude, Longitude
}

// Complete mapping for Province Codes to Names
const PROVINCE_MAP: Record<string, string> = {
    // Direct-controlled municipalities
    "BJ": "北京",
    "SH": "上海",
    "TJ": "天津",
    "CQ": "重庆",
    // Provinces
    "HE": "河北",
    "SX": "山西",
    "NM": "内蒙古",
    "LN": "辽宁",
    "JL": "吉林",
    "HL": "黑龙江",
    "JS": "江苏",
    "ZJ": "浙江",
    "AH": "安徽",
    "FJ": "福建",
    "JX": "江西",
    "SD": "山东",
    "HA": "河南",
    "HB": "湖北",
    "HN": "湖南",
    "GD": "广东",
    "GX": "广西",
    "HI": "海南",
    "SC": "四川",
    "GZ": "贵州",
    "YN": "云南",
    "XZ": "西藏",
    "SN": "陕西",
    "GS": "甘肃",
    "QH": "青海",
    "NX": "宁夏",
    "XJ": "新疆",
    // SARs & Taiwan
    "TW": "台湾",
    "HK": "香港",
    "MO": "澳门",
    // Aliases sometimes used by different DBs
    "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
    "21": "辽宁", "22": "吉林", "23": "黑龙江", "31": "上海", "32": "江苏",
    "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
    "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西",
    "46": "海南", "50": "重庆", "51": "四川", "52": "贵州", "53": "云南",
    "54": "西藏", "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏",
    "65": "新疆", "71": "台湾", "81": "香港", "82": "澳门"
};

export function resolveIPLocation(ip: string): GeoLocation | null {
    // Localhost handling
    if (ip === "127.0.0.1" || ip === "::1") {
        return {
            country: "CN",
            region: "SH",
            city: "上海"
        };
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const geoip = require('geoip-lite');
        const geo = geoip.lookup(ip);

        if (geo) {
            // Convert Region Code to Chinese Name if possible
            const provinceName = PROVINCE_MAP[geo.region] || geo.region;
            return {
                country: geo.country,
                region: provinceName,
                city: geo.city,
                ll: geo.ll
            };
        }
    } catch (e) {
        // GeoIP 数据文件缺失或查询失败，使用备选方案
        console.warn("GeoIP lookup failed:", e instanceof Error ? e.message : e);
        // 返回默认地理位置，避免服务中断
        return {
            country: "CN",
            region: "未知",
            city: "未知"
        };
    }

    return null;
}
