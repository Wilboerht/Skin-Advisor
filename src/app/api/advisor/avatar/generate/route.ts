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

        console.log(`🎨 Generating avatar for session ${sessionId}...`);

        // Build prompt for style transfer
        const rawGender = characteristics?.gender;
        const isMale = rawGender === 'male' || rawGender === '男';
        const gender = isMale ? '男' : '女';
        const age = characteristics?.age || '25';
        const skinTone = characteristics?.skinTone || '健康肤色';
        const hairStyle = characteristics?.hairStyle || '日常发型';

        const prompt = `将图片中的人像转为日系美妆插画风格，【核心要求：必须具备极高的人貌相似度，严格保留原照片的五官比例、脸型特征、眼神和发型等所有个人身份细节，仅仅是给照片加上插画滤镜感，绝对不能改变本人的长相特征，要让人能一眼认出就是本人】（性别：${gender}，大约${age}岁，肤色：${skinTone}，发型：${hairStyle}），【构图绝对要求：如果原图中面部特写占比过大，请务必自动缩小人物比例，向外扩展画幅以自然地露出肩膀和上身部分，生成一个标准且构图舒适的半身头像；人物必须严格位于画面的垂直中轴线上，头上需留有适当的背景留白，左右两侧背景留白必须完全对称均等】，必须是标准的正面头像视角，人物的头部和身体都必须笔直正对镜头，绝对不能歪头、侧身或歪着身子，仅保留单一主体人物，【背景绝对规定：彻底清除原图背景！必须是极简的、完全平面的均一单色背景（淡米色或纯白色），背景上绝对不能有任何渐变色、阴影、光斑、线条、纹理、图案或残影，整个背景必须完全是一模一样的纯色】，适当轻度美颜并保留本人原本骨相特色、给角色自然微笑表情`;

        let imageUrl: string | null = null;
        let source = "fallback";

        // Strategy 1: Try Jimeng (Volcengine) async img2img — Primary
        console.log("🔍 Checking Jimeng credentials...");
        console.log(`   VOLC_ACCESSKEY set: ${!!process.env.VOLC_ACCESSKEY}`);
        console.log(`   VOLC_SECRETKEY set: ${!!process.env.VOLC_SECRETKEY}`);
        
        if (process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY) {
            try {
                // First attempt: img2img with user face reference
                if (frontPhoto) {
                    console.log("📸 Attempting Jimeng img2img (jimeng_i2i_v30) with user photo...");
                    imageUrl = await generateJimengAvatarAsync(prompt, frontPhoto, 'jimeng_i2i_v30');
                    if (imageUrl) {
                        console.log("✅ Jimeng img2img succeeded");
                        source = "jimeng_img2img";
                    }
                }

                // Second attempt: Jimeng text-to-image (no photo needed, more reliable)
                if (!imageUrl) {
                    console.log("🎨 Attempting Jimeng text-to-image (jimeng_t2i_v30)...");
                    imageUrl = await generateJimengAvatarAsync(prompt, null, 'jimeng_t2i_v30');
                    if (imageUrl) {
                        console.log("✅ Jimeng t2i succeeded");
                        source = "jimeng_t2i";
                    }
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error("❌ Jimeng generation failed:", errorMsg);
                
                // Log specific error types to help debugging
                if (errorMsg.includes('Access Denied') || errorMsg.includes('Unauthorized')) {
                    console.error("🔴 Jimeng 权限错误 - 凭证可能无效");
                    console.error("   检查项: VOLC_ACCESSKEY 和 VOLC_SECRETKEY 在 Vercel 中是否正确");
                } else if (errorMsg.includes('credentials not configured')) {
                    console.error("🔴 Jimeng 凭证未被读取 - 环境变量可能未加载");
                    console.error("   检查项: Vercel 部署是否完成，环境变量是否应用");
                }
            }
        } else {
            console.warn("⚠️  Jimeng 未配置 - 缺少: VOLC_ACCESSKEY/VOLC_SECRETKEY");
            console.warn(`   VOLC_ACCESSKEY: ${process.env.VOLC_ACCESSKEY ? '已设置' : '未设置'}`);
            console.warn(`   VOLC_SECRETKEY: ${process.env.VOLC_SECRETKEY ? '已设置' : '未设置'}`);
        }

        // Strategy 2: Try OpenAI DALL-E 3 (text-to-image fallback)
        if (!imageUrl && process.env.OPENAI_API_KEY) {
            try {
                console.log("🎨 Attempting OpenAI DALL-E 3...");
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
                    if (imageUrl) {
                        console.log("✅ OpenAI DALL-E 3 succeeded");
                        source = "openai";
                    }
                }
            } catch (e) {
                console.error("❌ OpenAI generation failed:", e instanceof Error ? e.message : e);
            }
        } else if (!imageUrl && !process.env.OPENAI_API_KEY) {
            console.warn("⚠️  OpenAI 未配置 (OPENAI_API_KEY missing)");
        }

        // Strategy 3: Standard Placeholder fallback
        if (!imageUrl) {
            console.warn("⚠️  All AI providers failed. Using placeholder fallback.");
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
            select: { analysisResult: true, userId: true }
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

            // 如果用户未设置自定义头像，自动更新为其生成的 AI 头像
            if (session.userId) {
                const user = await prisma.user.findUnique({
                    where: { id: session.userId },
                    select: { avatarUrl: true }
                });

                // 判断是否是系统生成的头像、占位图或者是空
                if (user && (!user.avatarUrl || user.avatarUrl === '/user-placeholder.svg' || user.avatarUrl.includes('avatar-ai-'))) {
                    await prisma.user.update({
                        where: { id: session.userId },
                        data: { avatarUrl: url }
                    });
                    console.log(`Updated user ${session.userId} avatar with newly generated AI avatar`);
                }
            }
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
    // Trim keys to avoid newline issues from .env parsing (should be raw decoded values)
    const accessKeyId = (process.env.VOLC_ACCESSKEY || '').trim();
    const secretKeyRaw = (process.env.VOLC_SECRETKEY || '').trim();

    // Validate credentials exist
    if (!accessKeyId || !secretKeyRaw) {
        console.error("❌ Jimeng credentials missing: VOLC_ACCESSKEY or VOLC_SECRETKEY not configured");
        throw new Error("Jimeng credentials not configured");
    }

    // Debug: Log credential format validation
    console.log(`🔐 Credential analysis:`);
    console.log(`   VOLC_ACCESSKEY: ${accessKeyId.substring(0, 10)}...${accessKeyId.substring(accessKeyId.length - 4)}`);
    console.log(`   VOLC_SECRETKEY (raw): ${secretKeyRaw.substring(0, 10)}...${secretKeyRaw.substring(secretKeyRaw.length - 4)}`);
    console.log(`   VOLC_SECRETKEY length: ${secretKeyRaw.length}`);
    console.log(`   VOLC_SECRETKEY format: ${/^[a-f0-9]{32}$/i.test(secretKeyRaw) ? '✅ Hex (32 chars)' : /^[A-Za-z0-9+/=]+$/.test(secretKeyRaw) ? '⚠️  Base64' : '❌ Unknown'}`);

    // Try to detect if still Base64 and handle accordingly
    let secretKey = secretKeyRaw;
    
    // If it looks like Base64 (not hex), try using it as-is for signature calculation
    if (/^[A-Za-z0-9+/=]+$/.test(secretKeyRaw) && !/^[a-f0-9]{32}$/i.test(secretKeyRaw)) {
        console.log(`   ℹ️  Secret Key appears to be Base64, using as-is for SDK`);
    }

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
    
    const submitResStr = JSON.stringify(submitRes).substring(0, 300);
    console.log("Jimeng submit response:", submitResStr);

    // Check for success; code 10000 = OK
    if (!submitRes || submitRes.code !== 10000) {
        const errorMsg = submitRes?.message || submitRes;
        
        // Provide specific guidance for common errors
        if (typeof errorMsg === 'string') {
            if (errorMsg.includes('Access Denied')) {
                throw new Error(`Jimeng 认证失败（Access Denied）- 检查 VOLC_ACCESSKEY 和 VOLC_SECRETKEY 是否正确配置`);
            } else if (errorMsg.includes('Unauthorized')) {
                throw new Error(`Jimeng 权限不足（Unauthorized）- 凭证可能已过期或无权限`);
            }
        }
        
        throw new Error(`Jimeng submit failed: ${submitResStr}`);
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
