
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const { updates } = await req.json();

        // Transactional update
        await prisma.$transaction(
            updates.map((u: any) =>
                prisma.advisorQuestion.update({
                    where: { id: u.id },
                    data: {
                        order: u.order,
                        active: u.active
                    }
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
}
