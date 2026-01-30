import { SignJWT, importPKCS8 } from "jose";

// Credential Configuration
const QWEATHER_KEY_ID = "KJGUJC85DY";
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEILh6f4Pr8XqWFYm9CT6UAmG7sZ3UuPLqBwj4K50lKOZo
-----END PRIVATE KEY-----`;

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

/**
 * Generate JWT Token for QWeather API (EdDSA)
 */
async function getAuthToken(): Promise<string> {
    try {
        const alg = 'EdDSA';
        const pkcs8 = await importPKCS8(PRIVATE_KEY_PEM, alg);

        const jwt = await new SignJWT({})
            .setProtectedHeader({ alg, kid: QWEATHER_KEY_ID })
            .setSubject(QWEATHER_KEY_ID)
            .setIssuedAt()
            .setExpirationTime('1h') // Token valid for 1 hour
            .sign(pkcs8);

        return jwt;
    } catch (e) {
        console.error("JWT Generation Failed", e);
        throw e;
    }
}

interface NominatimResult {
    address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        province?: string;
    };
}

/**
 * 反向地理编码：通过坐标获取位置名称 (Nominatim/OSM)
 */
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'MySkin.Today/1.0' },
                next: { revalidate: 86400 },
                signal: controller.signal
            });

            if (!res.ok) return null;

            const data: NominatimResult = await res.json();
            if (!data.address) return null;

            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.county || '';
            const state = addr.state || addr.province || '';

            if (state && city) return `${state} ${city}`;
            if (city) return city;
            if (state) return state;

            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (e) {
        console.warn("Reverse geocoding failed:", e instanceof Error ? e.message : e);
        return null;
    }
}

async function fetchQWeather(endpoint: string, params: Record<string, string>) {
    // 1. Generate Token
    const token = await getAuthToken();

    // 2. Build URL (No 'key' param needed)
    const searchParams = new URLSearchParams(params);
    const baseUrl = endpoint.includes("city/lookup") ? BASE_URL_GEO : BASE_URL_API;
    const url = `${baseUrl}/${endpoint}?${searchParams.toString()}`;

    // 3. Setup fast timeout (3 seconds) to avoid blocking page load
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const res = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            next: { revalidate: 1800 },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            console.warn(`QWeather API Failed: ${res.status} (${url})`);
            return null;
        }

        const data = await res.json();
        if (data.code !== "200") {
            console.warn(`QWeather API Code Error: ${data.code} for ${url}`);
            return null;
        }
        return data;
    } catch (e) {
        clearTimeout(timeoutId);
        // Suppress abort errors, just log warning
        if (e instanceof Error && e.name === 'AbortError') {
            console.warn(`QWeather timeout (3s): ${endpoint}`);
        } else {
            console.warn("QWeather Fetch Failed:", e instanceof Error ? e.message : e);
        }
        return null;
    }
}

export async function getSkinEnvData(locationInput: string): Promise<SkinEnvData> {

    // Default Fallback
    const fallbackData: SkinEnvData = {
        uvIndex: 5,
        humidity: 45,
        aqi: 75,
        temperature: 20,
        location: "通用环境",
        weatherText: "多云",
        isRealData: false
    };

    if (!locationInput || locationInput === "标准测试环境" || locationInput === "通用环境") return fallbackData;

    try {
        // --- Strategy: Handle Coordinates Robustly ---
        let locationQuery = locationInput;
        let displayName = "通用环境"; // Default safe name
        const isCoordinate = /^[-\d\.]+,[-\d\.]+$/.test(locationInput);

        // 1. Try Geo Lookup for Name & ID
        try {
            const geoParams: Record<string, string> = { location: locationInput, number: "1" };
            const geoData = await fetchQWeather("city/lookup", geoParams);

            if (geoData && geoData.location && geoData.location.length > 0) {
                const cityInfo = geoData.location[0];
                locationQuery = cityInfo.id; // Switch to precise ID
                displayName = `${cityInfo.adm1} ${cityInfo.name}`;
            } else {
                // Lookup failed
                if (isCoordinate) {
                    // Coordinate query for lookup failed (maybe ocean/remote?)
                    // We can still try querying weather with raw coords
                    locationQuery = locationInput;

                    // 尝试反向地理编码获取真实地名
                    const coordParts = locationInput.split(',').map(parseFloat);
                    if (coordParts.length === 2) {
                        // QWeather uses lon,lat format, but we need lat,lon for Nominatim
                        const [num1, num2] = coordParts;
                        const lat = Math.abs(num1) > 90 ? num2 : num1;
                        const lon = Math.abs(num1) > 90 ? num1 : num2;
                        const reverseName = await reverseGeocode(lat, lon);
                        displayName = reverseName || "当前位置";
                    } else {
                        displayName = "当前位置";
                    }
                } else {
                    // Name query failed (e.g. "Mars"), cannot proceed
                    return fallbackData;
                }
            }
        } catch (e) {
            // Network or 404 error during lookup
            if (isCoordinate) {
                locationQuery = locationInput;

                // 尝试反向地理编码获取真实地名
                const coordParts = locationInput.split(',').map(parseFloat);
                if (coordParts.length === 2) {
                    const [num1, num2] = coordParts;
                    const lat = Math.abs(num1) > 90 ? num2 : num1;
                    const lon = Math.abs(num1) > 90 ? num1 : num2;
                    const reverseName = await reverseGeocode(lat, lon);
                    displayName = reverseName || "当前位置";
                } else {
                    displayName = "当前位置";
                }
            } else {
                return fallbackData;
            }
        }

        // 2. Fetch Data in Parallel
        const [weatherNow, airNow, weather3d] = await Promise.all([
            fetchQWeather("weather/now", { location: locationQuery }),
            fetchQWeather("air/now", { location: locationQuery }),
            fetchQWeather("weather/3d", { location: locationQuery })
        ]);

        // If core weather data fails, we must fallback
        if (!weatherNow) return fallbackData;

        // 3. Aggregate
        let uv = 5; // Default safe UV
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
            uv = parseInt(weather3d.daily[0].uvIndex) || 0;
        }

        return {
            uvIndex: uv,
            humidity: hum,
            aqi: aqiVal,
            temperature: temp,
            location: displayName,
            weatherText: text,
            isRealData: true
        };

    } catch (e) {
        console.error("Critical error in getSkinEnvData", e);
        return fallbackData;
    }
}
