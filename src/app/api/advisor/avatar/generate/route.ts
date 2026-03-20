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

        const prompt = `Transform the person in the image into a Japanese beauty makeup illustration style. Retain facial features as accurately as possible. Keep only the upper body/bust. Apply subtle beauty enhancements with a warm friendly smile. Style: Japanese commercial beauty illustration, soft lighting, pastel colors, high detail. Background: Simple soft gradient. Keep the same ${gender} person as the original photo, approximate age ${age}.`;

        let imageUrl: string | null = null;
        let source = "fallback";

        // Strategy 1: Try Jimeng (Volcengine) async img2img — Primary
        if (process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY) {
            try {
                // First attempt: img2img with user face reference
                if (frontPhoto) {
                    console.log("Attempting Jimeng img2img (I2ISmartDrawing) with user photo...");
                    imageUrl = await generateJimengAvatarAsync(prompt, frontPhoto, 'i2i_smart_drawing');
                    if (imageUrl) source = "jimeng_img2img";
                }

                // Second attempt: Jimeng text-to-image (no photo needed, more reliable)
                if (!imageUrl) {
                    console.log("Attempting Jimeng text-to-image (HighAesSmartDrawing)...");
                    imageUrl = await generateJimengAvatarAsync(prompt, null, 'high_aes_smart_drawing');
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

        // Strategy 3: DiceBear fallback
        if (!imageUrl) {
            console.warn("All AI providers failed. Using DiceBear fallback.");
            imageUrl = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(nickname || sessionId)}&style=circle`;

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

        if (session?.analysisResult) {
            const updatedResult = {
                ...(session.analysisResult as any),
                generatedAvatar: url
            };

            await prisma.advisorSession.update({
                where: { sessionId },
                data: { analysisResult: updatedResult }
            });
        }
    } catch (e) {
        console.error("Failed to update session with avatar URL:", e);
    }
}

// ============================================================================
// Jimeng (Volcengine) Async Img2Img via CVSync2AsyncSubmitTask + polling
// Docs: https://www.volcengine.com/docs/6791/1395327
// req_key: "i2i_smart_drawing" = 即梦图生图3.0智能参考
// ============================================================================
async function generateJimengAvatarAsync(
    prompt: string,
    frontPhoto?: string | null,
    reqKey: string = 'i2i_smart_drawing'
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
        prompt: prompt,
        scale: 3.5,
        seed: -1,
        logo_info: { add_logo: false },
    };

    // Only add size params for text-to-image mode (img2img infers from input)
    if (!frontPhoto || reqKey === 'high_aes_smart_drawing') {
        submitParams.width = 1024;
        submitParams.height = 1024;
        submitParams.ddim_steps = 25;
    }

    // For img2img: add strength and reference_mode
    if (reqKey === 'i2i_smart_drawing') {
        submitParams.strength = 0.7;    // 0.0-1.0, higher = closer to reference
        submitParams.reference_mode = 1; // 1 = subject/face reference
    }

    // Attach user photo as reference image
    if (frontPhoto) {
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
    const submitRes = await submitApi(submitParams) as any;
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

    // Poll for result up to 60 seconds
    const MAX_POLLS = 20;
    const POLL_INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_POLLS; i++) {
        await sleep(POLL_INTERVAL_MS);

        const resultRes = await getResultApi({
            req_key: submitParams.req_key,
            task_id: taskId,
        }) as any;

        console.log(`Poll ${i + 1}: status=${resultRes?.data?.status}, code=${resultRes?.code}`);

        if (!resultRes || resultRes.code !== 10000) {
            // Transient error, keep polling
            continue;
        }

        const status = resultRes.data?.status;

        if (status === 'success' || status === 'done' || status === 'Success' || status === 'SUCCEED') {
            // Extract image URL
            const imgData = resultRes.data;

            if (imgData?.image_url) {
                return imgData.image_url;
            }
            if (imgData?.image_urls && imgData.image_urls.length > 0) {
                return imgData.image_urls[0];
            }
            if (imgData?.binary_data_base64 && imgData.binary_data_base64.length > 0) {
                return `data:image/png;base64,${imgData.binary_data_base64[0]}`;
            }

            // Check nested data
            if (imgData?.images && imgData.images.length > 0) {
                return imgData.images[0].url || imgData.images[0].image_url || null;
            }

            console.warn("Jimeng task succeeded but no image found in response:", JSON.stringify(imgData).substring(0, 300));
            return null;
        }

        if (status === 'failed' || status === 'error') {
            throw new Error(`Jimeng task failed: ${JSON.stringify(resultRes.data?.message || resultRes.data).substring(0, 200)}`);
        }

        // Statuses like 'running', 'pending', 'waiting' → keep polling
    }

    throw new Error("Jimeng task timed out after polling (60s)");
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
