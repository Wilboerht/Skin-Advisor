import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
    const user = await getSession();

    if (!user) {
        redirect("/?auth=login&redirect=/profile");
    }

    return <ProfileClient />;
}
