import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy", // Fallback for build time
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, characteristics, nickname } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        console.log(`Generating avatar for session ${sessionId}...`);

        // Check if OpenAI key is configured
        if (!process.env.OPENAI_API_KEY) {
            console.warn("OPENAI_API_KEY not found, using fallback avatar generator");
            // Fallback to DiceBear with specific style that matches "cartoon/illustration"
            const fallbackUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(nickname || sessionId)}&style=circle`;

            // Save fallback result
            await updateSessionAvatar(sessionId, fallbackUrl);

            return NextResponse.json({
                success: true,
                url: fallbackUrl,
                source: "fallback"
            });
        }

        // Construct Prompt
        // "将图片中的人像转为日系美妆插画风格，尽可能还原所有人物特征及细节，仅保留人体部分，适当美颜、给角色微笑表情，并将人像水平居中显示"
        const gender = characteristics?.gender === 'male' ? '男' : '女';
        const age = characteristics?.age || '25';
        const skinTone = characteristics?.skinTone || '健康肤色';
        const hairStyle = characteristics?.hairStyle || ''; // Can be enriched if we had this data

        const prompt = `Japanese beauty illustration style avatar of a ${age} year old ${gender}, ${skinTone}, ${hairStyle}. 
        Close-up portrait, centered composition. 
        Style: Japanese commercial illustration, soft lighting, pastel colors, high detail, refined lines.
        Expression: Gentle smile, friendly.
        Features: Slightly beautified, clear skin.
        Background: SImple, soft solid color or gradient, no complex background.
        Medium: Digital 2D illustration.`;

        // Call OpenAI DALL-E 3
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "url",
        });

        if (!response.data || !response.data[0]) {
            throw new Error("Invalid response from OpenAI");
        }

        const tempUrl = response.data[0].url;

        if (!tempUrl) {
            throw new Error("No image URL returned from OpenAI");
        }

        // Download and upload to persistent storage
        let finalUrl = tempUrl;
        try {
            const { uploadImage } = await import("@/lib/upload-client");

            console.log("Downloading generated avatar from OpenAI...");
            const imgRes = await fetch(tempUrl);
            const blob = await imgRes.blob();

            console.log("Uploading avatar to persistent storage...");
            const filename = `avatar-ai-${sessionId}-${Date.now()}.png`;
            // @ts-ignore - Blob type compatibility
            finalUrl = await uploadImage(blob, filename);
            console.log("Avatar persisted at:", finalUrl);
        } catch (uploadError) {
            console.error("Failed to upload avatar to persistent storage, using temp URL:", uploadError);
        }

        await updateSessionAvatar(sessionId, finalUrl);

        return NextResponse.json({
            success: true,
            url: finalUrl,
            source: "openai"
        });

    } catch (error: any) {
        console.error("Avatar generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate avatar", details: error.message },
            { status: 500 }
        );
    }
}

async function updateSessionAvatar(sessionId: string, url: string) {
    try {
        // We need to update user's profile or analysis result
        // Since we don't have a dedicated 'avatar' field in AdvisorSession yet, 
        // we'll update the 'analysisResult' JSON.

        const session = await prisma.advisorSession.findUnique({
            where: { sessionId },
            select: { analysisResult: true }
        });

        if (session && session.analysisResult) {
            const currentResult = session.analysisResult as any;
            const updatedResult = {
                ...currentResult,
                generatedAvatar: url
            };

            await prisma.advisorSession.update({
                where: { sessionId },
                data: {
                    analysisResult: updatedResult
                }
            });
        }
    } catch (e) {
        console.error("Failed to update session with avatar URL:", e);
    }
}
