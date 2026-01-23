
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from "@/lib/prisma";

// Switch to Node.js runtime to support fs and prisma
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        let data = {
            score: searchParams.get('score') || '--',
            skinType: searchParams.get('skinType') || 'Unknown',
            date: searchParams.get('date') || new Date().toISOString().split('T')[0],
            summary: searchParams.get('summary'),
            dimensions: null as any,
            userInfo: null as any
        };

        if (id) {
            try {
                const session = await prisma.advisorSession.findUnique({
                    where: { sessionId: id },
                    select: { analysisResult: true, answers: true }
                });

                if (session && session.analysisResult) {
                    const res = session.analysisResult as any;
                    const face = res.faceAnalysis;
                    const skin = res.skinAnalysis || res.skinProfile;

                    data.score = face?.overallScore || skin?.score || data.score;
                    data.skinType = skin?.typeLabel || skin?.skinTypeLabel || data.skinType;
                    data.summary = skin?.summary || data.summary;
                    data.dimensions = face?.dimensions || null;

                    // User info if available (e.g. name from answers? usually anonymous)
                }
            } catch (err) {
                console.error("Error fetching session for image:", err);
            }
        }

        const { score, skinType, date, summary, dimensions, userInfo } = data;

        // Load Font
        let fontData: Buffer | null = null;
        try {
            const fontPath = path.join(process.cwd(), 'public/fonts/NotoSansSC-Regular.ttf');
            if (fs.existsSync(fontPath)) {
                fontData = fs.readFileSync(fontPath);
            }
        } catch (e) {
            console.error("Font load failed:", e);
        }

        // Colors
        const gold = '#C9A86C';
        const bg = '#0F1115';
        const text = '#F5E6E0';

        // Helper for dimension bars
        const DimensionBar = ({ label, score }: { label: string, score: number }) => (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, width: '100%' }}>
                <div style={{ width: 60, fontSize: 14, color: '#888' }}>{label}</div>
                <div style={{ flex: 1, height: 4, background: '#333', borderRadius: 2, marginLeft: 10, marginRight: 10 }}>
                    <div style={{ width: `${score}%`, height: '100%', background: gold, borderRadius: 2 }} />
                </div>
                <div style={{ width: 30, fontSize: 14, color: text, textAlign: 'right' }}>{score}</div>
            </div>
        );

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'row',
                        backgroundColor: bg,
                        backgroundImage: 'radial-gradient(circle at 10% 10%, #1A1D24 0%, #0F1115 80%)',
                        fontFamily: 'NotoSansSC',
                        position: 'relative',
                    }}
                >
                    {/* Left Panel: Score & Type */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRight: '1px solid rgba(201, 168, 108, 0.2)',
                        padding: 40
                    }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
                            <div style={{ color: text, fontSize: 24, fontWeight: 'bold', letterSpacing: '0.2em' }}>NIHPLOD</div>
                            <div style={{ color: gold, fontSize: 10, letterSpacing: '0.3em' }}>SKIN ADVISOR</div>
                        </div>

                        <div style={{ color: '#888', fontSize: 16, letterSpacing: '2px', marginBottom: 10 }}>SKIN TYPE</div>
                        <div style={{ color: gold, fontSize: 48, fontWeight: 'bold', marginBottom: 40 }}>{skinType || 'Unknown'}</div>

                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                width: 200, height: 200,
                                borderRadius: '50%',
                                border: `4px solid ${gold}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: `0 0 30px ${gold}40`
                            }}>
                                <div style={{ fontSize: 80, fontWeight: 'bold', color: text }}>{score || '-'}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: 40, color: '#666', fontSize: 14 }}>{date}</div>
                    </div>

                    {/* Right Panel: Details */}
                    <div style={{
                        flex: 1.2,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '60px 50px'
                    }}>
                        <div style={{ color: text, fontSize: 20, marginBottom: 20, borderBottom: `1px solid ${gold}`, paddingBottom: 10, display: 'flex', width: '100%' }}>
                            Analysis Summary
                        </div>

                        <div style={{
                            color: '#AAA',
                            fontSize: 16,
                            lineHeight: 1.6,
                            marginBottom: 40,
                            display: '-webkit-box',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            // lineClamp: 3 // Note: lineClamp might not work in Satori perfectly, use manual truncation if needed
                        }}>
                            {summary ? (summary.length > 80 ? summary.slice(0, 80) + '...' : summary) : 'Comprehensive skin analysis result based on AI scan.'}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div style={{ color: text, fontSize: 16, marginBottom: 15 }}>Key Dimensions</div>
                            {dimensions && Object.entries(dimensions).slice(0, 5).map(([key, val]: any) => (
                                <DimensionBar key={key} label={key.toUpperCase()} score={val?.score || 0} />
                            ))}
                            {!dimensions && <div style={{ color: '#666' }}>No dimension data available</div>}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center' }}>
                            {userInfo?.avatar && <img src={userInfo.avatar} width="40" height="40" style={{ borderRadius: '50%', marginRight: 10 }} />}
                            <div style={{ fontSize: 14, color: '#888' }}>
                                {userInfo?.name ? `Report for ${userInfo.name}` : 'NIHPLOD User'}
                            </div>
                        </div>
                    </div>
                </div>

            ),
            {
                width: 1200,
                height: 630,
                fonts: fontData ? [
                    {
                        name: 'NotoSansSC',
                        data: fontData,
                        style: 'normal',
                    },
                ] : undefined,
            }
        );
    } catch (e: any) {
        console.log(`${e.message}`);
        return new Response(`Failed to generate the image`, {
            status: 500,
        });
    }
}

