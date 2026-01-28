/**
 * Open-Meteo 天气 API
 * 免费、无需 API Key、无需注册
 * 文档: https://open-meteo.com/
 */

export interface SkinEnvData {
    uvIndex: number;
    humidity: number;
    temperature: number;
    location: string;
    weatherText?: string;
    isRealData: boolean;
}

// 天气代码映射（WMO Weather interpretation codes）
const WEATHER_CODES: Record<number, string> = {
    0: "晴",
    1: "晴", 2: "多云", 3: "阴",
    45: "雾", 48: "雾凇",
    51: "小雨", 53: "中雨", 55: "大雨",
    56: "冻雨", 57: "冻雨",
    61: "小雨", 63: "中雨", 65: "大雨",
    66: "冻雨", 67: "冻雨",
    71: "小雪", 73: "中雪", 75: "大雪",
    77: "雪粒",
    80: "阵雨", 81: "阵雨", 82: "暴雨",
    85: "阵雪", 86: "暴雪",
    95: "雷暴",
    96: "雷暴", 99: "雷暴冰雹"
};

interface GeocodingResult {
    results?: Array<{
        id: number;
        name: string;
        latitude: number;
        longitude: number;
        country: string;
        admin1?: string;
    }>;
}

interface WeatherResult {
    current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
    };
    daily?: {
        uv_index_max?: number[];
    };
}

/**
 * 通过城市名获取坐标
 */
async function geocodeCity(cityName: string): Promise<{ lat: number; lon: number; name: string } | null> {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh&format=json`;

        // Setup timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

        try {
            const res = await fetch(url, {
                next: { revalidate: 86400 }, // 缓存1天
                signal: controller.signal
            });

            if (!res.ok) return null;

            const data: GeocodingResult = await res.json();
            if (!data.results || data.results.length === 0) return null;

            const city = data.results[0];
            return {
                lat: city.latitude,
                lon: city.longitude,
                name: city.admin1 ? `${city.admin1} ${city.name}` : city.name
            };
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (e) {
        console.error("Open-Meteo Geocoding failed:", e);
        return null;
    }
}

/**
 * 获取天气数据
 */
async function fetchWeather(lat: number, lon: number): Promise<WeatherResult | null> {
    try {
        // 请求当前天气和今日UV指数
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=uv_index_max&timezone=auto&forecast_days=1`;

        // Setup timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

        try {
            const res = await fetch(url, {
                next: { revalidate: 1800 }, // 缓存30分钟
                signal: controller.signal
            });

            if (!res.ok) {
                console.warn(`Open-Meteo API Failed: ${res.status}`);
                return null;
            }

            return await res.json();
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (e) {
        // Don't log abortion errors as errors, just warnings or ignore
        if (e instanceof Error && e.name === 'AbortError') {
            console.warn("Open-Meteo Weather fetch timed out (4s)");
        } else {
            console.error("Open-Meteo Weather fetch failed:", e);
        }
        return null;
    }
}

/**
 * 获取护肤相关环境数据
 */
export async function getSkinEnvData(locationInput: string): Promise<SkinEnvData> {
    // 默认回退数据
    const fallbackData: SkinEnvData = {
        uvIndex: 5,
        humidity: 45,
        temperature: 20,
        location: "通用环境",
        weatherText: "多云",
        isRealData: false
    };

    if (!locationInput || locationInput === "标准测试环境" || locationInput === "通用环境") {
        return fallbackData;
    }

    try {
        let lat: number, lon: number;
        let displayName = "当前位置";

        // 检查是否为坐标格式 (lon,lat 或 lat,lon)
        const coordMatch = locationInput.match(/^([-\d.]+)[,，]([-\d.]+)$/);

        if (coordMatch) {
            // 解析坐标 - 假设是 lon,lat 格式（和风天气格式）
            const num1 = parseFloat(coordMatch[1]);
            const num2 = parseFloat(coordMatch[2]);

            // 判断哪个是经度哪个是纬度（中国经度 73-135，纬度 3-54）
            if (Math.abs(num1) > 90) {
                // num1 > 90 说明是经度
                lon = num1;
                lat = num2;
            } else if (Math.abs(num2) > 90) {
                lon = num2;
                lat = num1;
            } else {
                // 两个都在合理范围内，默认假设是 lon,lat
                lon = num1;
                lat = num2;
            }
        } else {
            // 城市名查询
            const geoResult = await geocodeCity(locationInput);
            if (!geoResult) {
                return fallbackData;
            }
            lat = geoResult.lat;
            lon = geoResult.lon;
            displayName = geoResult.name;
        }

        // 获取天气数据
        const weather = await fetchWeather(lat, lon);
        if (!weather || !weather.current) {
            return fallbackData;
        }

        const current = weather.current;
        const uvMax = weather.daily?.uv_index_max?.[0] ?? 5;

        return {
            uvIndex: Math.round(uvMax),
            humidity: current.relative_humidity_2m ?? 50,
            temperature: Math.round(current.temperature_2m ?? 20),
            location: displayName,
            weatherText: WEATHER_CODES[current.weather_code ?? 0] || "未知",
            isRealData: true
        };

    } catch (e) {
        console.error("Critical error in getSkinEnvData:", e);
        return fallbackData;
    }
}
