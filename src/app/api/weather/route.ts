import { NextRequest, NextResponse } from "next/server";
// 使用 Open-Meteo (免费、无需 API Key)
// 如需切换回和风天气，将下面的 import 改为 "@/lib/qweather"
import { getSkinEnvData } from "@/lib/open-meteo";

export const runtime = "nodejs"; // more stable for local dev fetch

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    // Check if client provided lat/lon
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    let locationQuery = city;
    if (!locationQuery && lat && lon) {
        // Round to 2 decimals for cache friendliness
        // Open-Meteo 使用 lat,lon 格式，这里保持 lon,lat 格式在 lib 中处理
        locationQuery = `${parseFloat(lon).toFixed(2)},${parseFloat(lat).toFixed(2)}`;
    }

    if (!locationQuery) {
        return NextResponse.json({ error: "Missing location parameter" }, { status: 400 });
    }

    // Fallback data to return if weather API is unreachable
    const fallbackData = {
        uvIndex: 5,
        humidity: 50,
        aqi: 75,
        temperature: 20,
        location: "通用环境",
        weatherText: "多云",
        isRealData: false
    };

    // Race the API call against a 5-second timeout to guarantee fast response
    const timeoutPromise = new Promise<typeof fallbackData>((resolve) => {
        setTimeout(() => resolve(fallbackData), 5000);
    });

    try {
        const data = await Promise.race([
            getSkinEnvData(locationQuery),
            timeoutPromise
        ]);
        return NextResponse.json(data);
    } catch (e) {
        console.warn("Weather API route error:", e);
        return NextResponse.json(fallbackData);
    }
}
