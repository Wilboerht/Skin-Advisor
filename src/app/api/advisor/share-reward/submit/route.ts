import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const submitSchema = z.object({
    name: z.string().min(1, "姓名不能为空"),
    phone: z.string().min(1, "手机号不能为空"),
    address: z.string().min(1, "收货地址不能为空"),
    shareProofUrl: z.string().min(1, "必须上传截图证据"),
    skinScore: z.number().optional(),
    percentile: z.number().optional()
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 兼容旧前端字段映射 (如果前端尚未更新)
        // 假设 contact 可能是 "{name} {phone}" 或只传了 phone
        // 这里我们优先取标准字段，如果没有标准字段，尝试从 contact 解析 (但这不可靠)
        // 强制要求前端传标准字段

        const validation = submitSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Invalid data", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { name, phone, address, shareProofUrl, skinScore, percentile } = validation.data;

        // 检查是否重复提交 (例如同手机号近期提交过?)
        // 暂时不做严格限制，或者检查 status=pending 的
        const existing = await prisma.shareReward.findFirst({
            where: {
                phone: phone,
                status: "pending"
            }
        });

        if (existing) {
            // 可以选择更新或者拒绝。这里选择更新截图? 或者返回错误。
            // 为简单起见，允许覆盖或返回已存在
            /*
            return NextResponse.json({
                success: true,
                data: existing,
                message: "Request already pending"
            });
            */
            // 或者创建一个新的
        }

        const submission = await prisma.shareReward.create({
            data: {
                name,
                phone,
                address,
                shareProofUrl,
                skinScore: skinScore || 0,
                percentile: percentile || 0,
                status: "pending"
            }
        });

        return NextResponse.json({
            success: true,
            data: submission
        });

    } catch (error) {
        console.error("Submission failed:", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
