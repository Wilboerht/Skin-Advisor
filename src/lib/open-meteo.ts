/**
 * Open-Meteo 天气 API
 * 免费、无需 API Key、无需注册
 * 文档: https://open-meteo.com/
 */

export interface SkinEnvData {
    uvIndex: number;
    humidity: number;
    aqi: number;
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

function getWeatherDescription(code?: number): string {
    if (code === undefined) return "未知";
    return WEATHER_CODES[code] || "未知";
}

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export async function getSkinEnvData(locationInput: string): Promise<SkinEnvData> {
    // Default Mock Data
    const mockData: SkinEnvData = {
        uvIndex: 3,
        humidity: 55,
        aqi: 50,
        temperature: 22,
        location: "环境数据(模拟)",
        weatherText: "晴",
        isRealData: false
    };

    if (!locationInput) return mockData;

    try {
        // 1. Resolve Coordinates
        let lat = 31.23, lon = 121.47; // Default Shanghai
        let locationName = locationInput;

        // Check if input is "lon,lat" or "lat,lon"
        const coords = locationInput.split(",");

        if (coords.length === 2) {
            const num1 = parseFloat(coords[0]);
            const num2 = parseFloat(coords[1]);

            // Simple heuristic to detect lat/lon vs lon/lat:
            // Lat is -90 to 90. Lon is -180 to 180.
            // If num1 > 90 or < -90, it MUST be longitude.
            if (num1 > 90 || num1 < -90) {
                lon = num1; lat = num2;
            } else {
                // But wait, our route.ts constructs "lon,lat".
                lon = num1; lat = num2;
            }

            // Reverse Geocode name if input is coordinates
            try {
                // Nominatim Reverse (Free, Rate limited)
                // Use shorter timeout for address lookup
                const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`;
                const geoRes = await fetchWithTimeout(geoUrl, 3000);
                if (geoRes.ok) {
                    const geoJson = await geoRes.json();
                    locationName = geoJson.address.city || geoJson.address.town || geoJson.address.county || "当前位置";
                } else {
                    locationName = "当前位置";
                }
            } catch (e) {
                locationName = "当前位置";
            }
        }

        // 2. Fetch Weather Data (Open-Meteo)
        // https://open-meteo.com/en/docs
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&daily=uv_index_max&timezone=auto&forecast_days=1`;
        const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi&timezone=auto`;

        // Parallel fetch with timeout
        const [weatherRes, airRes] = await Promise.allSettled([
            fetchWithTimeout(weatherUrl, 5000),
            fetchWithTimeout(airUrl, 5000)
        ]);

        if (weatherRes.status === 'rejected') throw weatherRes.reason;

        const weatherResVal = (weatherRes as PromiseFulfilledResult<Response>).value;
        if (!weatherResVal.ok) throw new Error(`Weather API Error: ${weatherResVal.status}`);

        const weatherData = await weatherResVal.json();

        let aqi = 50;
        if (airRes.status === 'fulfilled' && airRes.value.ok) {
            const airData = await airRes.value.json();
            aqi = airData.current?.european_aqi || 50;
        }

        const current = weatherData.current;
        const daily = weatherData.daily;

        return {
            uvIndex: daily?.uv_index_max?.[0] ?? 0,
            humidity: current?.relative_humidity_2m ?? 50,
            aqi: aqi, // Open-Meteo AQI is European scale usually, roughly map to US/CN
            temperature: current?.temperature_2m ?? 20,
            location: locationName,
            weatherText: getWeatherDescription(current?.weather_code),
            isRealData: true
        };

    } catch (e) {
        console.error("Open-Meteo Fetch Failed:", e instanceof Error ? e.message : String(e));
        return mockData;
    }
}
