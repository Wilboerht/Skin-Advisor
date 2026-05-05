/**
 * 头像生成队列处理器
 * 后台异步处理队列中的头像生成请求
 */


import prisma from "@/lib/prisma";
import { Service } from "@volcengine/openapi";

/**
 * SSRF 防护：校验 URL 是否为可安全请求的公网地址
 */
function isPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 http(s)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // 拒绝 localhost 及 loopback
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0:0:0:0:0:0:0:1") {
      return false;
    }

    // 拒绝 IPv4 私有/本地链路地址
    if (/^10\./.test(hostname)) return false;                      // 10.0.0.0/8
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false; // 172.16.0.0/12
    if (/^192\.168\./.test(hostname)) return false;                // 192.168.0.0/16
    if (/^169\.254\./.test(hostname)) return false;                // 169.254.0.0/16 (link-local)

    // 拒绝 IPv6 loopback / link-local / unique-local
    if (hostname.startsWith("fc") || hostname.startsWith("fd")) return false; // unique-local
    if (hostname.startsWith("fe80:")) return false;               // link-local

    return true;
  } catch {
    return false;
  }
}

// 阿里万相头像生成（新版 wan2.5-i2i-preview，异步轮询）
async function generateWanxiangAvatarAsync(prompt: string, frontPhoto: string | null | undefined): Promise<string | null> {
  const apiKey = (process.env.WANXIANG_API_KEY || process.env.QWEN_API_KEY || "").trim();
  if (!apiKey) throw new Error("Wanxiang API Key not configured");

  const endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "X-DashScope-Async": "enable",
  };

  // 构造请求体（新版 input/parameters 嵌套结构）
  const images: string[] = [];
  if (frontPhoto) {
    if (frontPhoto.startsWith("data:")) {
      // 新版 API 支持完整 data URI 格式传入 images 数组
      images.push(frontPhoto);
    } else if (
      frontPhoto.startsWith("/") ||
      frontPhoto.includes("localhost") ||
      frontPhoto.includes("127.0.0.1")
    ) {
      // 相对路径或本地地址：万象服务器无法访问，需要下载转成 base64
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const fullUrl = frontPhoto.startsWith("/") ? `${baseUrl}${frontPhoto}` : frontPhoto;
        if (!isPublicUrl(fullUrl)) {
          console.warn("[Wanxiang] Blocked non-public URL:", fullUrl);
        } else {
          const res = await fetch(fullUrl);
          if (res.ok) {
            const blob = await res.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            const base64 = buffer.toString("base64");
            const mimeType = blob.type || "image/jpeg";
            images.push(`data:${mimeType};base64,${base64}`);
            console.log("[Wanxiang] Converted local image to base64 for upload");
          } else {
            console.warn("[Wanxiang] Failed to fetch local image:", res.status);
          }
        }
      } catch (e) {
        console.warn("[Wanxiang] Failed to convert local image to base64:", e);
      }
    } else {
      // 公网 URL：万象服务器可以直接访问
      images.push(frontPhoto);
    }
  }

  const body = {
    model: "wan2.5-i2i-preview",
    input: {
      prompt,
      ...(images.length > 0 ? { images } : {}),
    },
    parameters: {
      n: 1,
      size: "1024*1024",
      watermark: false,
      prompt_extend: true, // 保持自动扩展以提升画面丰富度
      negative_prompt: "腮红,红晕,脸红,脸颊泛红,胭脂,blush,rosy cheeks,flushed cheeks,面部泛红,红色晕染,血色,面部红晕,绯红",
    },
  };

  // 1. 提交异步任务
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const submitRes = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`Wanxiang submit error: ${submitRes.status} ${err}`);
  }

  const submitData = await submitRes.json();
  const taskId = submitData?.output?.task_id;
  if (!taskId) {
    throw new Error(`No task_id returned from Wanxiang submit: ${JSON.stringify(submitData)}`);
  }

  console.log(`[Wanxiang] Task submitted, taskId=${taskId}`);

  // 2. 轮询查询结果（最长 60 秒）
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 30000);
    const queryRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: pollController.signal,
    });
    clearTimeout(pollTimeout);

    if (!queryRes.ok) {
      console.warn(`[Wanxiang] Query failed: ${queryRes.status}`);
      continue;
    }

    const queryData = await queryRes.json();
    const status = queryData?.output?.task_status;

    if (status === "SUCCEEDED") {
      const url = queryData?.output?.results?.[0]?.url || queryData?.output?.image_url;
      if (url) {
        console.log(`[Wanxiang] Task completed after ${i + 1} attempts`);
        return url;
      }
    } else if (status === "FAILED") {
      throw new Error(`Wanxiang task failed: ${queryData?.output?.message || JSON.stringify(queryData)}`);
    } else if (i % 5 === 0) {
      console.log(`[Wanxiang] Still processing... (${i + 1}/${maxAttempts})`);
    }
  }

  throw new Error("Wanxiang task polling timeout");
}

export interface AvatarQueueItem {
  id: string;
  sessionId: string;
  nickname?: string | null;
  characteristics?: any;
  frontPhoto?: string | null;
}

/**
 * 删除头像生成的原始源照片（通过 dynamic import 避免 Edge Runtime 静态分析）
 */
async function deleteSourcePhoto(frontPhoto: string | null | undefined): Promise<void> {
  const { deleteSourcePhoto: doDelete } = await import("./file-cleanup");
  await doDelete(frontPhoto);
}

/**
 * 生成头像的完整逻辑（从 generate/route.ts 迁移）
 */
async function generateAvatarImage(
  frontPhoto: string | null | undefined,
  characteristics: any,
  nickname: string
): Promise<{ url: string; source: string } | null> {
  // Build prompt
  const rawGender = characteristics?.gender;
  const isMale = rawGender === "male" || rawGender === "男";
  const gender = isMale ? "男" : "女";
  const age = characteristics?.age || "25";
  const skinTone = characteristics?.skinTone || "健康肤色";
  const hairStyle = characteristics?.hairStyle || "日常发型";

  // 核心约束前置+后置，防止被长文本稀释
  const prompt = `面部肤色干净自然。水彩手绘风格半身像，头顶预留一定空间，清新治愈，纯白背景，视觉焦点突出，质感柔和。头发以水彩平涂+勾线为主，不同区域勾线颜色有区分，面部和手部轮廓为暖咖色。衣服无外轮廓线，水彩平涂保留肌理，内部有白色细线条交代细节。整幅画低饱和度柔和色调，通透水彩笔触与简约线条，日系清新插画，比例3:4竖版。`;

  let imageUrl: string | null = null;
  let source = "fallback";


  // 策略 1: Wanxiang image2image
  if (process.env.WANXIANG_API_KEY || process.env.QWEN_API_KEY) {
    try {
      console.log("🖼️ Attempting Wanxiang image2image...");
      imageUrl = await generateWanxiangAvatarAsync(prompt, frontPhoto);
      if (imageUrl) {
        console.log("✅ Wanxiang image2image succeeded");
        source = "wanxiang";
        return { url: imageUrl, source };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("❌ Wanxiang generation failed:", errorMsg);
      // 失败则继续尝试 Jimeng
    }
  }

  // 策略 2: Jimeng img2img
  if (process.env.VOLC_ACCESSKEY && process.env.VOLC_SECRETKEY) {
    try {
      if (frontPhoto) {
        console.log("📸 Attempting Jimeng img2img...");
        imageUrl = await generateJimengAvatarAsync(
          prompt,
          frontPhoto,
          "jimeng_i2i_v30"
        );
        if (imageUrl) {
          console.log("✅ Jimeng img2img succeeded");
          source = "jimeng_i2i";
          return { url: imageUrl, source };
        }
      }

      // 策略 3: Jimeng text2image
      console.log("🎨 Attempting Jimeng text-to-image...");
      imageUrl = await generateJimengAvatarAsync(
        prompt,
        null,
        "jimeng_t2i_v30"
      );
      if (imageUrl) {
        console.log("✅ Jimeng t2i succeeded");
        source = "jimeng_t2i";
        return { url: imageUrl, source };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("❌ Jimeng generation failed:", errorMsg);
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("限流") ||
        errorMsg.includes("Quota")
      ) {
        console.warn("🔴 Jimeng 已超限");
        // Jimeng 超限，直接降级
      } else {
        // 其它错误直接降级
        return null;
      }
    }
  }

  // 降级：使用占位符
  console.warn("⚠️ All generation strategies failed, using fallback");
  return { url: "/user-placeholder.svg", source: "fallback" };
}

/**
 * Jimeng API 调用
 */
async function generateJimengAvatarAsync(
  prompt: string,
  frontPhoto: string | null | undefined,
  reqKey: string
): Promise<string | null> {
  const accessKeyId = (process.env.VOLC_ACCESSKEY || "").trim();
  const secretKeyRaw = (process.env.VOLC_SECRETKEY || "").trim();

  if (!accessKeyId || !secretKeyRaw) {
    throw new Error("Jimeng credentials not configured");
  }

  const service = new (Service as any)({
    host: "cv.volcengineapi.com",
    region: "cn-beijing",
    serviceName: "cv",
  });
  
  service.setAccessKeyId(accessKeyId);
  service.setSecretKey(secretKeyRaw);

  // Build request body
  const reqBody: any = {
    req_key: reqKey,
    prompt: prompt,
    negative_prompt: "腮红,红晕,脸红,脸颊泛红,胭脂,blush,rosy cheeks,flushed cheeks,面部泛红,红色晕染,血色,面部红晕,绯红",
    model_version: "general",
    return_url: true,
    width: 1024,
    height: 1536,
  };

  // Add image parameter if provided (for img2img)
  if (frontPhoto && frontPhoto.startsWith("data:")) {
    // Base64 encoded image
    reqBody.image_base64 = frontPhoto.split(",")[1];
  } else if (frontPhoto) {
    // URL reference
    reqBody.image_url = frontPhoto;
  }

  console.log(
    `[Jimeng] Submitting task: reqKey=${reqKey}, has_image=${!!frontPhoto}`
  );

  try {
    // 新版 @volcengine/openapi 没有 service.json()，需要用 createJSONAPI()
    const submitAPI = service.createJSONAPI("CVSync2AsyncSubmitTask", {
      Version: "2022-08-31",
    });
    const submitRes = await submitAPI(reqBody);

    if (!submitRes || (submitRes as any).error || (submitRes as any).code !== 0) {
      const error = (submitRes as any)?.error || (submitRes as any)?.code;
      throw new Error(`Jimeng submit failed: ${JSON.stringify(error)}`);
    }

    const reqId = (submitRes as any)?.data?.req_id;
    if (!reqId) {
      throw new Error("No request ID returned from Jimeng submit");
    }

    console.log(`[Jimeng] Task submitted, reqId=${reqId}, polling for result...`);

    // Poll for result (max 60 seconds)
    const getResultAPI = service.createJSONAPI("CVSync2AsyncGetResult", {
      Version: "2022-08-31",
    });
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1s between polls

      const queryRes = await getResultAPI({ req_id: reqId });

      const status = (queryRes as any)?.data?.task_status;
      const resultUrl = (queryRes as any)?.data?.image_url;

      if (status === "succeed" && resultUrl) {
        console.log(`[Jimeng] ✅ Task completed after ${i + 1} attempts`);
        return resultUrl;
      } else if (status === "failed") {
        throw new Error(`Jimeng task failed: ${(queryRes as any)?.data?.fail_reason}`);
      } else if (status === "processing") {
        // Continue polling
        if (i % 5 === 0) {
          console.log(`[Jimeng] Still processing... (${i + 1}/${maxAttempts})`);
        }
      }
    }

    throw new Error("Jimeng task polling timeout");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Jimeng] Error: ${msg}`);
    throw error;
  }
}

/**
 * 处理单个队列项
 */
export async function processAvatarQueueItem(item: AvatarQueueItem) {
  console.log(
    `[AvatarQueue] Processing ${item.id} for session ${item.sessionId}`
  );

  // 保存原始照片引用，用于生成成功后清理
  const sourcePhoto = item.frontPhoto;

  try {
    // Update status to processing
    await prisma.avatarQueue.update({
      where: { id: item.id },
      data: {
        status: "processing",
        startedAt: new Date(),
      },
    });

    // Generate avatar
    const result = await generateAvatarImage(
      item.frontPhoto,
      item.characteristics,
      item.nickname || "用户"
    );

    if (!result) {
      throw new Error("Avatar generation returned no result");
    }

    // 使用事务确保两个表的更新原子性
    // 要么都成功，要么都失败重试
    try {
      await prisma.$transaction(async (tx) => {
        // 先读取当前 session 的结果
        const session = await tx.advisorSession.findUnique({
          where: { sessionId: item.sessionId },
          select: { analysisResult: true },
        });

        if (!session) {
          // Session 尚未创建（analyze 还未完成），先把 generatedUrl 存到 avatarQueue 本身
          await tx.avatarQueue.update({
            where: { id: item.id },
            data: {
              status: "completed",
              generatedUrl: result.url,
              source: result.source,
              completedAt: new Date(),
              frontPhoto: null, // 清空原始照片数据
            },
          });
          console.log(`[AvatarQueue] ✅ Avatar generated but session not yet created. Stored in avatarQueue for later sync.`);
          return;
        }

        const currentResult = (session.analysisResult as any) || {};
        const updatedResult = {
          ...currentResult,
          generatedAvatar: result.url,
        };

        // 同时更新两个表
        await Promise.all([
          tx.avatarQueue.update({
            where: { id: item.id },
            data: {
              status: "completed",
              generatedUrl: result.url,
              source: result.source,
              completedAt: new Date(),
              frontPhoto: null, // 清空原始照片数据
            },
          }),
          tx.advisorSession.update({
            where: { sessionId: item.sessionId },
            data: { analysisResult: updatedResult },
          }),
        ]);

        console.log(`[AvatarQueue] ✅ Successfully updated session ${item.sessionId} with avatar`);
      });

      // 事务成功后，删除原始源照片（本地/云端）
      await deleteSourcePhoto(sourcePhoto);
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : String(txError);
      console.warn(
        `[AvatarQueue] ⚠️  Transaction failed (will retry): ${msg}`
      );

      // 标记为待重试，而不是完成
      const attempts = (item as any).attempts + 1;
      if (attempts < 3) {
        await prisma.avatarQueue.update({
          where: { id: item.id },
          data: {
            status: "pending",
            attempts,
            errorMessage: `Failed to sync with session: ${msg}`,
          },
        });
        console.log(
          `[AvatarQueue] Marked for retry (${attempts}/3): ${item.id}`
        );
      } else {
        // 尝试 3 次后放弃，标记为失败
        await prisma.avatarQueue.update({
          where: { id: item.id },
          data: {
            status: "failed",
            attempts,
            errorMessage: `Failed to sync after 3 attempts: ${msg}`,
            completedAt: new Date(),
            frontPhoto: null, // 清理原始照片数据
          },
        });
        await deleteSourcePhoto(sourcePhoto).catch(() => {});
        console.error(
          `[AvatarQueue] ❌ Transaction failed after 3 retries: ${item.id}`
        );
      }

      // 事务失败已在内层处理（retry / failed），不再抛到外层
      return;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[AvatarQueue] ❌ Failed to process ${item.id}: ${msg}`);

    // Update to failed
    const attempts = item.sessionId ? (item as any).attempts + 1 : 1;
    if (attempts < 3) {
      // Retry
      await prisma.avatarQueue.update({
        where: { id: item.id },
        data: {
          status: "pending",
          attempts,
          errorMessage: msg,
        },
      });
      console.log(
        `[AvatarQueue] Marked for retry (${attempts}/3): ${item.id}`
      );
    } else {
      // Give up
      await prisma.avatarQueue.update({
        where: { id: item.id },
        data: {
          status: "failed",
          attempts,
          errorMessage: msg,
          completedAt: new Date(),
          frontPhoto: null, // 清理原始照片数据
        },
      });
      await deleteSourcePhoto(sourcePhoto).catch(() => {});
      console.error(
        `[AvatarQueue] ❌ Gave up after 3 attempts: ${item.id}`
      );
    }
  }
}

/**
 * 启动后台队列处理器
 * 应该在应用启动时调用一次
 */
export function startAvatarQueueProcessor(checkIntervalMs: number = 2000) {
  let isActive = true;
  let isProcessing = false;

  async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    try {
      // 获取pending队列中的第一个
      const nextItem = await prisma.avatarQueue.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
      });

      if (nextItem) {
        await processAvatarQueueItem(nextItem);
      }

      // 清理过期的队列项 (7天前的)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await prisma.avatarQueue.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(`[AvatarQueue] Cleaned up ${result.count} expired items`);
      }
    } catch (error) {
      console.error("[AvatarQueue] Processor error:", error);
    } finally {
      isProcessing = false;

      // Schedule next check
      if (isActive) {
        setTimeout(processQueue, checkIntervalMs);
      }
    }
  }

  // Start processing
  console.log(`[AvatarQueue] Processor started (checking every ${checkIntervalMs}ms)`);
  processQueue();

  // Return stop function
  return () => {
    isActive = false;
    console.log("[AvatarQueue] Processor stopped");
  };
}
