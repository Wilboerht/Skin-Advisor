import { NextRequest, NextResponse } from "next/server";
import { generateText, extractJson, isAIEnabled, getAISettings, getApiKeysForProvider, createOpenAIClient } from "@/lib/ai";
import prisma from "@/lib/prisma";
import { ChatRequestSchema } from "@/lib/schemas";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Sanitize user message to prevent prompt injection.
 * Blocks common injection patterns that try to override system instructions.
 */
function sanitizeUserMessage(input: string): string {
    if (!input || typeof input !== "string") return "";
    // Block common injection keywords/patterns (case-insensitive)
    const blockedPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions/gi,
        /ignore\s+(the\s+)?system\s+prompt/gi,
        /you\s+are\s+now\s+/gi,
        /system\s*:\s*/gi,
        /---\s*system\s*---/gi,
        /new\s+role\s*:/gi,
        /disregard\s+(all\s+)?prior\s+/gi,
        /override\s+(the\s+)?previous/gi,
        /simulate\s+/gi,
        /act\s+as\s+/gi,
        /角色扮演/gi,
        /忽略之前/gi,
        /系统提示/gi,
    ];
    let sanitized = input;
    for (const pattern of blockedPatterns) {
        sanitized = sanitized.replace(pattern, "[BLOCKED]");
    }
    // Limit length to prevent token abuse
    const MAX_MESSAGE_LENGTH = 2000;
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    }
    return sanitized;
}

// 聊天 API (DB Persisted for logged-in users only)
// Note: Ensure `npx prisma generate` is run if types are missing

export async function POST(request: NextRequest) {
    try {
        // 0. 检查 AI 开关
        if (!(await isAIEnabled())) {
            return NextResponse.json(
                { success: false, error: "AI 助手当前已暂停服务" },
                { status: 503 }
            );
        }

        const body = await request.json();

        // 1. 验证请求数据
        const validation = ChatRequestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "请求格式错误",
                    details: validation.error.flatten().fieldErrors
                },
                { status: 400 }
            );
        }

        let { message, context, sessionId } = validation.data;

        // Sanitize user message to prevent prompt injection
        message = sanitizeUserMessage(message);
        if (!message.trim()) {
            return NextResponse.json(
                { success: false, error: "消息内容无效或包含被禁止的指令" },
                { status: 400 }
            );
        }

        // 检查用户登录状态
        const user = await getSession();
        const isLoggedIn = !!user;

        // IP-based Rate Limiting for ALL users (prevents guest abuse of AI API tokens)
        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const ipLimit = await rateLimit(`chat-${ip}`, "chat", { maxRequests: isLoggedIn ? 20 : 5 });

        if (!ipLimit.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: "发送太频繁，请稍后再试",
                    rateLimit: {
                        limit: ipLimit.limit,
                        remaining: 0,
                        reset: ipLimit.reset
                    }
                },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Limit": String(ipLimit.limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": String(ipLimit.reset)
                    }
                }
            );
        }

        // DB-based Rate Limiting (10 messages per minute per session) - 已登录用户额外检查
        let rateLimitRemaining = 10;

        if (sessionId && isLoggedIn) {
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
            const recentMessages = await prisma.conversationMessage.count({
                where: {
                    conversation: { sessionId },
                    role: 'user',
                    createdAt: { gt: oneMinuteAgo }
                }
            });

            rateLimitRemaining = Math.max(0, 10 - recentMessages);

            if (recentMessages >= 10) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "发送太频繁，请稍后再试",
                        rateLimit: {
                            limit: 10,
                            remaining: 0,
                            reset: Math.ceil((oneMinuteAgo.getTime() + 60000 - Date.now()) / 1000)
                        }
                    },
                    {
                        status: 429,
                        headers: {
                            "X-RateLimit-Limit": "10",
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": String(Date.now() + 60000)
                        }
                    }
                );
            }
        }

        // 保存用户消息（仅限已登录用户）
        let conversationId = null;
        if (sessionId && isLoggedIn) {
            try {
                // 查找或创建对话
                let conversation = await prisma.conversation.findFirst({
                    where: { sessionId },
                    orderBy: { updatedAt: 'desc' }
                });

                if (!conversation) {
                    const sessionExists = await prisma.advisorSession.findUnique({ where: { sessionId } });
                    if (sessionExists) {
                        conversation = await prisma.conversation.create({
                            data: { sessionId }
                        });
                    }
                }

                if (conversation) {
                    conversationId = conversation.id;
                    await prisma.conversationMessage.create({
                        data: {
                            conversationId: conversation.id,
                            role: 'user',
                            content: message
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to save user message:", e);
            }
        }



        // 构建 System Prompt
        const systemPrompt = `你是一位专业的皮肤科医生和护肤顾问。
用户的肤质分析结果如下：
- 肤质类型：${context?.skinType || "未知"}
- 关注问题：${context?.concerns?.join("、") || "无"}
- 综合评价：${context?.summary || "无"}

请根据用户的肤质情况，简短、专业、友善地回答用户的问题。
回答不仅要给出解决方案，还要解释原因，体现专业性。
如果用户问的问题与护肤无关，请礼貌地将话题引回护肤。`;

        // 调用 AI (Streaming)
        const settings = await getAISettings();
        const provider = settings.provider || "openai";
        const apiKeys = getApiKeysForProvider(provider, settings);

        if (apiKeys.length === 0) {
            throw new Error(`No API keys found for provider: ${provider}`);
        }

        // Use the first available key for now (simple round-robin or first is fine since we aren't doing the complex retry loop here easily without refactor)
        const client = createOpenAIClient(provider, apiKeys[0]);

        const stream = await client.chat.completions.create({
            model: settings.model || "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                // Add History
                ...(conversationId ? (await prisma.conversationMessage.findMany({
                    where: { conversationId: conversationId, role: { in: ['user', 'assistant'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 6
                })).reverse().filter(m => m.content !== message).map(m => ({ role: m.role as "user" | "assistant", content: m.content })) : []),
                { role: "user", content: message }
            ],
            stream: true,
            temperature: settings.temperature || 0.7,
            max_tokens: settings.maxTokens || 1000
        });

        // 创建 ReadableStream
        const encoder = new TextEncoder();
        let fullResponse = "";

        const customStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            fullResponse += content;
                            controller.enqueue(encoder.encode(content));
                        }
                    }

                    // 结束后保存到数据库
                    if (conversationId && fullResponse) {
                        try {
                            await prisma.conversationMessage.create({
                                data: {
                                    conversationId,
                                    role: 'assistant',
                                    content: fullResponse
                                }
                            });
                            await prisma.conversation.update({
                                where: { id: conversationId },
                                data: { updatedAt: new Date() }
                            });
                        } catch (e) {
                            console.error("Failed to save assistant message:", e);
                        }
                    }

                    controller.close();
                } catch (err) {
                    console.error("Stream error:", err);
                    controller.error(err);
                }
            }
        });

        return new Response(customStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-RateLimit-Limit': '10',
                'X-RateLimit-Remaining': String(Math.max(0, rateLimitRemaining - 1))
            }
        });

    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json(
            { success: false, error: "AI 服务暂时不可用" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
        return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    // 未登录用户返回空历史记录
    const user = await getSession();
    if (!user) {
        return NextResponse.json({ success: true, history: [] });
    }

    try {
        const conversation = await prisma.conversation.findFirst({
            where: { sessionId },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
            orderBy: { updatedAt: 'desc' }
        });

        if (!conversation) {
            return NextResponse.json({ success: true, history: [] });
        }

        return NextResponse.json({ success: true, history: conversation.messages });
    } catch (error) {
        console.error("Chat History Error:", error);
        return NextResponse.json({ success: false, error: "无法获取历史记录" }, { status: 500 });
    }
}
