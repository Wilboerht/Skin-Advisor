import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }

        const body = await req.json();
        const { name, avatar } = body;

        const updateData: { name?: string; avatarUrl?: string } = {};
        if (typeof name === "string") {
            updateData.name = name.trim().slice(0, 20);
        }
        if (typeof avatar === "string") {
            updateData.avatarUrl = avatar.trim();
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "没有要更新的内容" }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.id },
            data: updateData,
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                avatarUrl: true,
                role: true,
            },
        });

        return NextResponse.json({
            user: {
                id: updatedUser.id,
                phone: updatedUser.phoneNumber,
                name: updatedUser.name,
                avatar: updatedUser.avatarUrl,
                role: updatedUser.role,
            },
        });
    } catch (error) {
        console.error("[user/profile] Update failed:", error);
        return NextResponse.json({ error: "更新失败" }, { status: 500 });
    }
}
