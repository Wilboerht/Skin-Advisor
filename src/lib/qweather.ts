import { headers } from "next/headers";

const QWEATHER_KEY = "a7c89169b99bfc904bae64470aba3f4a713b89becaa11d702fb99f605567e274";
const BASE_URL_API = "https://devapi.qweather.com/v7";
const BASE_URL_GEO = "https://geoapi.qweather.com/v2";

export interface SkinEnvData {
    uvIndex: number;
    humidity: number;
    aqi: number;
    temperature: number;
    location: string;
    weatherText?: string;
    isRealData: boolean;
}

async function fetchQWeather(endpoint: string, params: Record<string, string>) {
    const searchParams = new URLSearchParams({
        ...params,
        key: QWEATHER_KEY
    });

    // Determine base URL
    const baseUrl = endpoint.includes("city/lookup") ? BASE_URL_GEO : BASE_URL_API;
    const url = `${baseUrl}/${endpoint}?${searchParams.toString()}`;

    try {
        const res = await fetch(url, { next: { revalidate: 1800 } }); // Cache for 30 mins
        if (!res.ok) {
            console.warn(`QWeather API Failed: ${res.status} (${url})`); // Warn instead of Error
            return null;
        }
        const data = await res.json();
        if (data.code !== "200") {
            console.error(`QWeather API Code Error: ${data.code} for ${url}`);
            return null;
        }
        return data;
    } catch (e) {
        console.error("QWeather Fetch Failed", e);
        return null;
    }
}

export async function getSkinEnvData(locationInput: string): Promise<SkinEnvData> {

    // Default Fallback Data (Beijingish)
    const fallbackData: SkinEnvData = {
        uvIndex: 5,
        humidity: 45,
        aqi: 75,
        temperature: 20,
        location: locationInput || "标准测试环境",
        weatherText: "多云",
        isRealData: false
    };

    if (!locationInput) return fallbackData;

    try {
        // 1. Geo Lookup: Get City ID
        // Strip common suffixes for better matching if needed, though API handles it well
        const geoData = await fetchQWeather("city/lookup", { location: locationInput, number: "1" });
        if (!geoData || !geoData.location || geoData.location.length === 0) {
            console.warn(`City not found: ${locationInput}`);
            return fallbackData;
        }

        const cityInfo = geoData.location[0];
        const locationId = cityInfo.id;
        const locationName = `${cityInfo.adm1} ${cityInfo.name}`;

        // 2. Fetch Data in Parallel
        const [weatherNow, airNow, weather3d] = await Promise.all([
            fetchQWeather("weather/now", { location: locationId }),
            fetchQWeather("air/now", { location: locationId }),
            fetchQWeather("weather/3d", { location: locationId })
        ]);

        // 3. Aggregate
        let uv = 0;
        let hum = 50;
        let temp = 20;
        let aqiVal = 50;
        let text = "";

        if (weatherNow && weatherNow.now) {
            hum = parseInt(weatherNow.now.humidity) || 50;
            temp = parseInt(weatherNow.now.temp) || 20;
            text = weatherNow.now.text;
        }

        if (airNow && airNow.now) {
            aqiVal = parseInt(airNow.now.aqi) || 50;
        }

        if (weather3d && weather3d.daily && weather3d.daily.length > 0) {
            // Use today's max UV index
            uv = parseInt(weather3d.daily[0].uvIndex) || 0;
        }

        return {
            uvIndex: uv,
            humidity: hum,
            aqi: aqiVal,
            temperature: temp,
            location: locationName,
            weatherText: text,
            isRealData: true
        };

    } catch (e) {
        console.error("Critical error in getSkinEnvData", e);
        return fallbackData;
    }
}
