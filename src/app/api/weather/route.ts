import { NextRequest, NextResponse } from "next/server";
import { getSkinEnvData } from "@/lib/qweather";

export const runtime = "nodejs"; // more stable for local dev fetch

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");

    // Check if client provided lat/lon, can handle later if needed
    // QWeather City Lookup works with 'lon,lat' string too!
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    let locationQuery = city;
    if (!locationQuery && lat && lon) {
        // Round to 2 decimals for cache friendliness and API format
        locationQuery = `${parseFloat(lon).toFixed(2)},${parseFloat(lat).toFixed(2)}`;
    }

    if (!locationQuery) {
        return NextResponse.json({ error: "Missing location parameter" }, { status: 400 });
    }

    const data = await getSkinEnvData(locationQuery);
    return NextResponse.json(data);
}
