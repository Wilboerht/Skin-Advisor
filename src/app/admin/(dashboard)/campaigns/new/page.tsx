import CampaignForm from "@/components/admin/CampaignForm";

// Force dynamic rendering to prevent static generation issues
export const dynamic = "force-dynamic";

export default function NewCampaignPage() {
    return <CampaignForm />;
}
