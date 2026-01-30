import { NextRequest, NextResponse } from "next/server";
import { getSkinEnvData as getOpenMeteoData } from "@/lib/open-meteo";
import { getSkinEnvData as getQWeatherData } from "@/lib/qweather";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    // Check if client provided lat/lon
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    let locationQuery = city;
    if (!locationQuery && lat && lon) {
        // Round to 2 decimals for cache friendliness
        locationQuery = `${parseFloat(lon).toFixed(2)},${parseFloat(lat).toFixed(2)}`;
    }

    if (!locationQuery) {
        return NextResponse.json({ error: "Missing location parameter" }, { status: 400 });
    }

    // Fallback data
    const fallbackData = {
        uvIndex: 5,
        humidity: 50,
        aqi: 75,
        temperature: 20,
        location: "通用环境",
        weatherText: "多云",
        isRealData: false
    };

    // Race with a global timeout of 8 seconds
    try {
        const result = await Promise.race([
            (async () => {
                // Try QWeather
                try {
                    const data = await getQWeatherData(locationQuery);
                    if (data.isRealData) return NextResponse.json(data);
                } catch (e) {
                    console.warn("QWeather attempt failed:", e);
                }

                // Try Open-Meteo
                try {
                    const data = await getOpenMeteoData(locationQuery);
                    if (data.isRealData) return NextResponse.json(data);
                } catch (e) {
                    console.warn("Open-Meteo attempt failed:", e);
                }

                return NextResponse.json(fallbackData);
            })(),
            new Promise<NextResponse>((resolve) =>
                setTimeout(() => {
                    console.error("Weather API Global Timeout (8s)");
                    resolve(NextResponse.json(fallbackData));
                }, 8000)
            )
        ]);

        return result;

    } catch (e) {
        console.error("Weather Route Critical Error:", e);
        return NextResponse.json(fallbackData);
    }
}
