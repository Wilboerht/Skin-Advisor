import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("nickname") || "User";
    const skinScore = searchParams.get("skinScore") || "88";

    // Create a simple SVG poster
    const svg = `
    <svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FAF8F5;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F5F0E8;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      
      <!-- Border -->
      <rect x="20" y="20" width="560" height="860" fill="none" stroke="#C8AA6E" stroke-width="2" />
      
      <!-- Content -->
      <text x="300" y="150" font-family="serif" font-size="40" text-anchor="middle" fill="#2D2D2D">NIHPLOD</text>
      <text x="300" y="200" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#666666">AI SKIN ADVISOR</text>
      
      <text x="300" y="350" font-family="serif" font-size="24" text-anchor="middle" fill="#2D2D2D">EXCLUSIVE REPORT FOR</text>
      <text x="300" y="400" font-family="serif" font-size="48" text-anchor="middle" fill="#C8AA6E">${nickname}</text>
      
      <circle cx="300" cy="550" r="80" fill="none" stroke="#C8AA6E" stroke-width="4" />
      <text x="300" y="540" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#666666">SKIN SCORE</text>
      <text x="300" y="590" font-family="serif" font-size="60" text-anchor="middle" fill="#2D2D2D" font-weight="bold">${skinScore}</text>
      
      <text x="300" y="800" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#999999">Scan to view full report</text>
    </svg>
  `;

    return new NextResponse(svg, {
        headers: {
            "Content-Type": "image/svg+xml",
        },
    });
}
