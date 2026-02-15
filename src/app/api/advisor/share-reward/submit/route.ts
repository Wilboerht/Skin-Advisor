import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Share Reward Submission API
 *
 * Security measures:
 * - Authentication required (logged-in users only)
 * - IP-based rate limiting (form preset: 10 submissions/min)
 * - Zod input validation with proper format constraints
 * - Deduplication (one pending submission per phone per campaign)
 * - Response doesn't leak full DB record
 */
const submitSchema = z.object({
    name: z.string()
        .trim()
        .min(2, "姓名长度不能少于2个字符")
        .max(20, "姓名长度不能超过20个字符"),
    phone: z.string()
        .trim()
        .regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
    address: z.string()
        .trim()
        .min(5, "地址过短，请填写完整地址")
        .max(200, "地址长度不能超过200个字符"),
    shareProofUrl: z.string()
        .trim()
        .min(1, "必须上传截图证据")
        .max(2000, "分享凭证地址过长"),
    skinScore: z.number().optional(),
    percentile: z.number().optional(),
    campaignId: z.string().optional()
});

export async function POST(request: NextRequest) {
    try {
        // 0. IP-based rate limiting
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
        const limit = await rateLimit(`share-reward-${ip}`, "form");

        if (!limit.success) {
            return NextResponse.json(
                { success: false, error: "提交过于频繁，请稍后再试" },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Limit": String(limit.limit),
                        "X-RateLimit-Remaining": String(limit.remaining),
                        "X-RateLimit-Reset": String(limit.reset),
                    }
                }
            );
        }

        // 1. Authentication — only logged-in users can submit
        const user = await getSession();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "请先登录后再参与活动" },
                { status: 401 }
            );
        }

        // 2. Parse & validate input
        const body = await request.json();
        const validation = submitSchema.safeParse(body);

        if (!validation.success) {
            // Return the first human-readable error
            const issues = validation.error.issues;
            const firstError = (issues.length > 0 ? issues[0].message : null) || "输入数据格式错误";
            return NextResponse.json(
                { success: false, error: firstError },
                { status: 400 }
            );
        }

        const { name, phone, address, shareProofUrl, skinScore, percentile, campaignId } = validation.data;

        // 3. Find active campaign
        let activeCampaignId = campaignId;
        if (!activeCampaignId) {
            const now = new Date();
            const activeCampaign = await prisma.campaign.findFirst({
                where: {
                    isActive: true,
                    startDate: { lte: now },
                    endDate: { gte: now }
                },
                select: { id: true, maxParticipants: true, currentParticipants: true }
            });

            if (activeCampaign) {
                // Check if campaign is full
                if (activeCampaign.maxParticipants &&
                    activeCampaign.currentParticipants >= activeCampaign.maxParticipants) {
                    return NextResponse.json({
                        success: false,
                        error: "活动名额已满，感谢您的参与！"
                    }, { status: 400 });
                }
                activeCampaignId = activeCampaign.id;
            }
        }

        // 4. Deduplication — prevent same phone from submitting multiple pending rewards per campaign
        if (activeCampaignId) {
            const existing = await prisma.shareReward.findFirst({
                where: {
                    phone: phone,
                    campaignId: activeCampaignId,
                    status: { in: ["pending", "approved", "shipped"] }
                }
            });

            if (existing) {
                return NextResponse.json({
                    success: false,
                    error: "您已经参与过本次活动，请勿重复提交"
                }, { status: 409 });
            }
        }

        // 5. Create submission in transaction (record + increment campaign participant count)
        const submission = await prisma.$transaction(async (tx) => {
            const reward = await tx.shareReward.create({
                data: {
                    name,
                    phone,
                    address,
                    shareProofUrl,
                    skinScore: skinScore || 0,
                    percentile: percentile || 0,
                    status: "pending",
                    campaignId: activeCampaignId || null
                }
            });

            // Update campaign participant count
            if (activeCampaignId) {
                await tx.campaign.update({
                    where: { id: activeCampaignId },
                    data: { currentParticipants: { increment: 1 } }
                });
            }

            return reward;
        });

        // Only return minimal data — don't leak full DB record
        return NextResponse.json({
            success: true,
            data: { id: submission.id, status: submission.status },
            message: "提交成功！我们会尽快审核您的申请"
        });

    } catch (error) {
        console.error("Submission failed:", error);
        return NextResponse.json(
            { success: false, error: "提交失败，请稍后重试" },
            { status: 500 }
        );
    }
}
