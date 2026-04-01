import { NextRequest, NextResponse } from "next/server";
import { getSkinEnvData as getOpenMeteoData } from "@/lib/open-meteo";
import { getSkinEnvData as getQWeatherData } from "@/lib/qweather";

export const runtime = "nodejs";

import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    // Check if client provided lat/lon
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    // Unified Location Key
    let locationQuery = city;
    let cacheKey = city;

    if (!locationQuery && lat && lon) {
        // Round to 2 decimals for cache friendliness and API stability
        const latFixed = parseFloat(lat).toFixed(2);
        const lonFixed = parseFloat(lon).toFixed(2);
        locationQuery = `${lonFixed},${latFixed}`;
        cacheKey = `${lonFixed},${latFixed}`;
    }

    if (!locationQuery) {
        return NextResponse.json({ error: "Missing location parameter" }, { status: 400 });
    }

    // 0. Cache Layer Check
    try {
        if (cacheKey) {
            const cached = await prisma.weatherCache.findUnique({
                where: { locationKey: cacheKey }
            });

            if (cached && cached.expiresAt > new Date()) {
                const data = JSON.parse(cached.data);
                // Return cached data
                return NextResponse.json(data, {
                    headers: { 'X-Weather-Cache': 'HIT' }
                });
            }
        }
    } catch (dbError) {
        console.warn("Weather DB Cache Read Failed:", dbError);
        // Continue to fetch...
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

    // Race with a global timeout of 6 seconds (reduced from 8s for better responsiveness)
    try {
        const resultResponse = await Promise.race([
            (async () => {
                // 优先使用 Open-Meteo （更稳定，无 API 密钥限制）
                try {
                    console.log("[Weather] Attempting Open-Meteo...");
                    const data = await getOpenMeteoData(locationQuery!);
                    if (data.isRealData) {
                        console.log("[Weather] ✅ Open-Meteo succeeded");
                        return NextResponse.json(data);
                    }
                } catch (e) {
                    console.warn("[Weather] Open-Meteo attempt failed:", e instanceof Error ? e.message : e);
                }

                // 备选：尝试 QWeather（可能存在 API 配置问题，保留备选）
                try {
                    console.log("[Weather] Attempting QWeather...");
                    const data = await getQWeatherData(locationQuery!);
                    if (data.isRealData) {
                        console.log("[Weather] ✅ QWeather succeeded");
                        return NextResponse.json(data);
                    }
                } catch (e) {
                    console.warn("[Weather] QWeather attempt failed:", e instanceof Error ? e.message : e);
                }

                console.warn("[Weather] 所有实时数据源均失败，返回降级数据");
                return NextResponse.json(fallbackData);
            })(),
            new Promise<NextResponse>((resolve) =>
                setTimeout(() => {
                    console.warn("[Weather] Global timeout (6s) - returning fallback");
                    resolve(NextResponse.json(fallbackData));
                }, 6000)
            )
        ]);

        // Write to Cache if successful
        try {
            const resultData = await resultResponse.json();
            if (resultData.isRealData && cacheKey) {
                await prisma.weatherCache.upsert({
                    where: { locationKey: cacheKey },
                    create: {
                        locationKey: cacheKey,
                        data: JSON.stringify(resultData),
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
                    },
                    update: {
                        data: JSON.stringify(resultData),
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
                    }
                });
            }
            // Need to return a fresh response because .json() consumes the body
            return NextResponse.json(resultData, {
                headers: { 'X-Weather-Cache': 'MISS' }
            });
        } catch (cacheError) {
            console.warn("Weather DB Cache Write Failed:", cacheError);
            return resultResponse;
        }

    } catch (e) {
        console.error("Weather Route Critical Error:", e);
        return NextResponse.json(fallbackData);
    }
}
