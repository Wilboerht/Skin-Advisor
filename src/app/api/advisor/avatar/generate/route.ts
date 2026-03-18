import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { Service } from "@volcengine/openapi";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy", // Fallback for build time
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, characteristics, nickname, frontPhoto } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        console.log(`Generating avatar for session ${sessionId}...`);

        // Construct Prompt
        const gender = characteristics?.gender === 'male' ? '男' : '女';
        const age = characteristics?.age || '25';
        const skinTone = characteristics?.skinTone || '健康肤色';
        const hairStyle = characteristics?.hairStyle || '';

        const prompt = `Japanese beauty illustration style avatar of a ${age} year old ${gender}, ${skinTone}, ${hairStyle}. 
        Close-up portrait, centered composition. 
        Style: Japanese commercial illustration, soft lighting, pastel colors, high detail, refined lines.
        Expression: Gentle smile, friendly.
        Background: Simple, soft solid color or gradient.`;

        let imageUrl: string | null = null;
        let source = "fallback";

        // Strategy 1: Try Jimeng (Volcengine)
        if (process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY) {
            try {
                console.log("Attempting to generate avatar using Jimeng (Volcengine)...");
                imageUrl = await generateJimengAvatar(prompt, frontPhoto);
                if (imageUrl) source = "jimeng";
            } catch (e) {
                console.error("Jimeng generation failed, falling back...", e);
            }
        }

        // Strategy 2: Try OpenAI DALL-E 3
        if (!imageUrl && process.env.OPENAI_API_KEY) {
            try {
                console.log("Attempting to generate avatar using OpenAI DALL-E 3...");
                const response = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    quality: "standard",
                    response_format: "url",
                });

                if (response.data && response.data[0]) {
                    imageUrl = response.data[0].url || null;
                    if (imageUrl) source = "openai";
                }
            } catch (e) {
                console.error("OpenAI generation failed, falling back...", e);
            }
        }
        // Strategy 3: Fallback to DiceBear
        if (!imageUrl) {
            console.warn("Using fallback DiceBear avatar");
            imageUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(nickname || sessionId)}&style=circle`;

            await updateSessionAvatar(sessionId, imageUrl);
            return NextResponse.json({
                success: true,
                url: imageUrl,
                source: "fallback"
            });
        }

        // Persistence Logic (skip for DiceBear)
        let finalUrl = imageUrl;
        try {
            const { uploadImage } = await import("@/lib/upload-client");

            console.log(`Downloading generated avatar from ${source}...`);
            const imgRes = await fetch(imageUrl);
            const blob = await imgRes.blob();

            console.log("Uploading avatar to persistent storage...");
            const filename = `avatar-ai-${sessionId}-${Date.now()}.png`;
            // @ts-ignore
            finalUrl = await uploadImage(blob, filename);
            console.log("Avatar persisted at:", finalUrl);
        } catch (uploadError) {
            console.error("Failed to upload avatar to persistent storage, using temp URL:", uploadError);
        }

        await updateSessionAvatar(sessionId, finalUrl);

        return NextResponse.json({
            success: true,
            url: finalUrl,
            source: source
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

// Jimeng (Volcengine) Generation Logic
async function generateJimengAvatar(prompt: string, frontPhoto?: string | null): Promise<string | null> {
    const service = new Service({
        host: 'visual.volcengineapi.com',
        serviceName: 'cv',
        region: 'cn-north-1',
        accessKeyId: process.env.VOLC_ACCESSKEY,
        secretKey: process.env.VOLC_SECRETKEY,
    });

    // Action: HighAesSmartDrawing (General T2I)
    // This is a synchronous call in some versions, but mostly async.
    // For simplicity, we assume the synchronous high-aesthetics endpoint or we handle polling if we get a task_id.
    // Spec: https://www.volcengine.com/docs/6791/116664

    const fetchApi = service.createAPI('HighAesSmartDrawing', {
        Version: '2022-08-31',
        method: 'POST',
        contentType: 'json',
    });

    // Jimeng usually requires separate prompt logic or specific parameters
    // We try to fit the standard Volcengine parameter structure
    const params: any = {
        req_key: "high_aes_smart_drawing",
        prompt: prompt,
        scale: 3.5,
        ddim_steps: 25,
        width: 1024,
        height: 1024,
        seed: -1,
        logo_info: {
            add_logo: false
        }
    };

    // If we have a front photo, use it for img2img (Image to Image generation)
    if (frontPhoto) {
        if (frontPhoto.startsWith('http')) {
            params.image_urls = [frontPhoto];
            // Optionally set image strength/weight here if the API allows e.g. params.strength = 0.5;
        } else if (frontPhoto.startsWith('data:image/')) {
            const base64Data = frontPhoto.split(',')[1];
            if (base64Data) {
                params.binary_data_base64 = [base64Data];
            }
        }
    }

    const res = await fetchApi(params) as any;

    // Check response structure
    // Typically: { code: 10000, data: { status: 'success', image_url: '...' } }
    // Or base64 data

    if (res && res.code === 10000 && res.data) {
        if (res.data.image_url) return res.data.image_url;
        if (res.data.binary_data_base64 && res.data.binary_data_base64.length > 0) {
            // Convert base64 to data URI
            return `data:image/png;base64,${res.data.binary_data_base64[0]}`;
        }
    }

    console.warn("Jimeng response invalid:", JSON.stringify(res).substring(0, 200));
    return null;
}
