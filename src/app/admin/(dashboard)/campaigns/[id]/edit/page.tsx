import CampaignForm from "@/components/admin/CampaignForm";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
        where: { id }
    });

    if (!campaign) {
        notFound();
    }

    // Convert Date objects to strings for the form
    const serializedCampaign = {
        ...campaign,
        description: campaign.description || "",
        rewardDescription: campaign.rewardDescription || "",
        rules: campaign.rules || "",
        bannerImage: campaign.bannerImage || "",
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        maxParticipants: campaign.maxParticipants || 0,
    };

    return <CampaignForm initialData={serializedCampaign} isEdit={true} />;
}
