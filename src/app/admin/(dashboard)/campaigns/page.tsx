import prisma from "@/lib/prisma";
import CampaignsClient from "@/components/admin/CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
    const rewards = await prisma.shareReward.findMany({
        orderBy: { createdAt: "desc" },
    });

    const serializedRewards = rewards.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt?.toISOString() || null,
    }));

    return <CampaignsClient initialRewards={serializedRewards} />;
}
