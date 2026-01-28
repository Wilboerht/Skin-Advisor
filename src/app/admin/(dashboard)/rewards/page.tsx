
import prisma from "@/lib/prisma";
import RewardsClient from "@/components/admin/RewardsClient";

export const dynamic = "force-dynamic";

interface Props {
    searchParams: Promise<{ status?: string }>;
}

export default async function RewardsPage({ searchParams }: Props) {
    const params = await searchParams;
    const status = params.status;

    const whereCondition = status && status !== 'all' ? { status } : {};

    const rewards = await prisma.shareReward.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
    });

    // Serialize dates for client component
    const serializedRewards = rewards.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt?.toISOString() || null,
    }));

    return <RewardsClient initialRewards={serializedRewards} />;
}
