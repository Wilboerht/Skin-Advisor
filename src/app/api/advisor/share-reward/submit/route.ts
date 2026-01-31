import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSession } from "@/lib/auth";

const submitSchema = z.object({
    name: z.string().min(1, "姓名不能为空"),
    phone: z.string().min(1, "手机号不能为空"),
    address: z.string().min(1, "收货地址不能为空"),
    shareProofUrl: z.string().min(1, "必须上传截图证据"),
    skinScore: z.number().optional(),
    percentile: z.number().optional(),
    campaignId: z.string().optional()
});

export async function POST(request: NextRequest) {
    try {
        // 只有登录用户才能提交分享奖励
        const user = await getSession();
        if (!user) {
            return NextResponse.json(
                { success: false, error: "请先登录后再参与活动" },
                { status: 401 }
            );
        }

        const body = await request.json();

        const validation = submitSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Invalid data", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { name, phone, address, shareProofUrl, skinScore, percentile, campaignId } = validation.data;

        // 查找当前活动（如果没有指定campaignId，自动查找活动中的活动）
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
                // 检查活动是否已满
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

        // 检查是否重复提交 (同一活动同一手机号)
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
                }, { status: 400 });
            }
        }

        // 使用事务创建记录并更新活动参与人数
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

            // 更新活动参与人数
            if (activeCampaignId) {
                await tx.campaign.update({
                    where: { id: activeCampaignId },
                    data: { currentParticipants: { increment: 1 } }
                });
            }

            return reward;
        });

        return NextResponse.json({
            success: true,
            data: submission,
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
