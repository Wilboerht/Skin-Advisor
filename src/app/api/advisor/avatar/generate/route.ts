import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "@/lib/prisma";
import { Service } from "@volcengine/openapi";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy",
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, characteristics, nickname, frontPhoto } = body;

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        console.log(`Generating avatar for session ${sessionId}...`);

        // Build prompt for style transfer
        const gender = characteristics?.gender === 'male' ? 'male' : 'female';
        const age = characteristics?.age || '25';
        const skinTone = characteristics?.skinTone || 'healthy';
        const hairStyle = characteristics?.hairStyle || 'elegant';

        const prompt = `Transform the person in the image into a Japanese beauty makeup illustration style. Retain facial features as accurately as possible. Keep only the upper body/bust. Apply subtle beauty enhancements with a warm friendly smile. Skin tone: ${skinTone}. Hair style: ${hairStyle}. Style: Japanese commercial beauty illustration, soft lighting, pastel colors, high detail. Background: Simple soft gradient. Keep the same ${gender} person as the original photo, approximate age ${age}.`;

        let imageUrl: string | null = null;
        let source = "fallback";

        // Strategy 1: Try Jimeng (Volcengine) async img2img — Primary
        if (process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY) {
            try {
                // First attempt: img2img with user face reference
                if (frontPhoto) {
                    console.log("Attempting Jimeng img2img (jimeng_i2i_v30) with user photo...");
                    imageUrl = await generateJimengAvatarAsync(prompt, frontPhoto, 'jimeng_i2i_v30');
                    if (imageUrl) source = "jimeng_img2img";
                }

                // Second attempt: Jimeng text-to-image (no photo needed, more reliable)
                if (!imageUrl) {
                    console.log("Attempting Jimeng text-to-image (jimeng_t2i_v30)...");
                    imageUrl = await generateJimengAvatarAsync(prompt, null, 'jimeng_t2i_v30');
                    if (imageUrl) source = "jimeng_t2i";
                }
            } catch (e) {
                console.error("Jimeng generation failed, falling back...", e);
            }
        }

        // Strategy 2: Try OpenAI DALL-E 3 (text-to-image fallback)
        if (!imageUrl && process.env.OPENAI_API_KEY) {
            try {
                console.log("Attempting OpenAI DALL-E 3...");
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
                console.error("OpenAI generation failed:", e);
            }
        }

        // Strategy 3: Standard Placeholder fallback
        if (!imageUrl) {
            console.warn("All AI providers failed. Using placeholder fallback.");
            imageUrl = `/user-placeholder.svg`;

            await updateSessionAvatar(sessionId, imageUrl);
            return NextResponse.json({ success: true, url: imageUrl, source: "fallback" });
        }

        // Persist to cloud storage
        let finalUrl = imageUrl;
        try {
            const { uploadImage } = await import("@/lib/upload-client");
            console.log(`Downloading generated avatar from ${source}...`);
            const imgRes = await fetch(imageUrl);
            const blob = await imgRes.blob();
            const filename = `avatar-ai-${sessionId}-${Date.now()}.png`;
            // @ts-ignore
            finalUrl = await uploadImage(blob, filename);
            console.log("Avatar persisted at:", finalUrl);
        } catch (uploadError) {
            console.error("Failed to upload avatar to persistent storage, using temp URL:", uploadError);
        }

        await updateSessionAvatar(sessionId, finalUrl);

        return NextResponse.json({ success: true, url: finalUrl, source });

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

        const currentResult = (session?.analysisResult as any) || {};
        const updatedResult = {
            ...currentResult,
            generatedAvatar: url
        };

        if (session) {
            await prisma.advisorSession.update({
                where: { sessionId },
                data: { analysisResult: updatedResult }
            });
            console.log(`Updated existing session ${sessionId} with avatar`);
        } else {
            // If main analysis hasn't created the session yet, we create it with just the avatar
            // The main analysis will later update it with reports
            await prisma.advisorSession.create({
                data: {
                    sessionId,
                    analysisResult: updatedResult,
                    faceScanUsed: true,
                    startedAt: new Date()
                }
            });
            console.log(`Created new session placeholder for ${sessionId} with avatar`);
        }
    } catch (e) {
        console.error("Failed to update session with avatar URL:", e);
    }
}

// ============================================================================
// Jimeng (Volcengine) Async Img2Img/T2I via CVSync2AsyncSubmitTask + polling
// Docs: https://www.volcengine.com/docs/85621/1747301?lang=zh (img2img)
// Docs: https://www.volcengine.com/docs/85621/1616429?lang=zh (text2img)
// req_key: "jimeng_i2i_v30" = 即梦图生图3.0智能参考
// req_key: "jimeng_t2i_v30" = 即梦文生图3.0
// ============================================================================
async function generateJimengAvatarAsync(
    prompt: string,
    frontPhoto?: string | null,
    reqKey: string = 'jimeng_t2i_v30'
): Promise<string | null> {
    // Trim keys to avoid newline issues from .env parsing
    const accessKeyId = (process.env.VOLC_ACCESSKEY || '').trim();
    const secretKey = (process.env.VOLC_SECRETKEY || '').trim();

    const service = new Service({
        host: 'visual.volcengineapi.com',
        serviceName: 'cv',
        region: 'cn-north-1',
        accessKeyId,
        secretKey,
    });

    const submitApi = service.createAPI('CVSync2AsyncSubmitTask', {
        Version: '2022-08-31',
        method: 'POST',
        contentType: 'json',
    });

    const getResultApi = service.createAPI('CVSync2AsyncGetResult', {
        Version: '2022-08-31',
        method: 'POST',
        contentType: 'json',
    });

    // Build submit params
    const submitParams: any = {
        req_key: reqKey,
        prompt: prompt,  // Recommended: <=120 chars, max 800 chars
        scale: 0.5,  // Official range: [0, 1], default: 0.5. Text influence: 0.5 = balanced
        seed: -1,
    };

    // Add width/height: Official range [512, 2016], recommended preset 1328x1328
    // Note: Final output is "nearest 16-multiple to input", range [512, 1536]
    if (reqKey === 'jimeng_t2i_v30') {
        submitParams.width = 1328;
        submitParams.height = 1328;
    } else if (reqKey === 'jimeng_i2i_v30') {
        // For img2img, also set recommended 1:1 aspect ratio
        // Input image constraint: ratio within 3:1, max 4096x4096, max 4.7MB
        submitParams.width = 1328;
        submitParams.height = 1328;
    }

    // Attach user photo as reference image (only for img2img)
    if (frontPhoto && reqKey === 'jimeng_i2i_v30') {
        if (frontPhoto.startsWith('http')) {
            submitParams.image_urls = [frontPhoto];
        } else if (frontPhoto.startsWith('data:image/')) {
            const base64Data = frontPhoto.split(',')[1];
            if (base64Data) {
                submitParams.binary_data_base64 = [base64Data];
            }
        }
    }

    console.log("Submitting Jimeng async task with req_key:", submitParams.req_key);
    const submitRes = await submitApi(submitParams, {
        Action: 'CVSync2AsyncSubmitTask',
        timeout: 60000
    } as any) as any;
    console.log("Jimeng submit response:", JSON.stringify(submitRes).substring(0, 300));

    // Check for success; code 10000 = OK
    if (!submitRes || submitRes.code !== 10000) {
        throw new Error(`Jimeng submit failed: ${JSON.stringify(submitRes?.message || submitRes).substring(0, 200)}`);
    }

    const taskId = submitRes.data?.task_id;
    if (!taskId) {
        throw new Error("Jimeng submit returned no task_id");
    }

    console.log(`Jimeng task submitted. task_id=${taskId}. Polling for result...`);

    // Poll for result up to 90 seconds (aligned with frontend timeout)
    const MAX_POLLS = 30;
    const POLL_INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);

        const resultRes = await getResultApi({
            req_key: submitParams.req_key,
            task_id: taskId,
        }, {
            Action: 'CVSync2AsyncGetResult',
            timeout: 15000
        } as any) as any;

        console.log(`Poll ${i + 1}: status=${resultRes?.data?.status}, code=${resultRes?.code}`);

        if (!resultRes || resultRes.code !== 10000) {
            // Transient error, keep polling
            continue;
        }

        const status = resultRes.data?.status;

        // Official status: in_queue, generating, done, not_found, expired
        if (status === 'done') {
            // Extract image URL
            const imgData = resultRes.data;

            if (imgData?.image_urls && imgData.image_urls.length > 0) {
                return imgData.image_urls[0];
            }
            if (imgData?.binary_data_base64 && imgData.binary_data_base64.length > 0) {
                return `data:image/png;base64,${imgData.binary_data_base64[0]}`;
            }

            console.warn("Jimeng task done but no image found in response:", JSON.stringify(imgData).substring(0, 300));
            return null;
        }

        if (status === 'not_found' || status === 'expired') {
            throw new Error(`Jimeng task ${status}`);
        }

        // Statuses like in_queue, generating → keep polling
    }

    throw new Error("Jimeng task timed out after polling (90s)");
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
