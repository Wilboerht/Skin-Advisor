import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/sso-auth";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
    const user = await getSessionUser();

    if (!user) {
        redirect("/?auth=login&redirect=/profile");
    }

    return <ProfileClient />;
}
