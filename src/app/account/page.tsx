import { redirect } from "next/navigation";
import { normalizeAccountTab } from "@/lib/account-tab";

export const metadata = {
  title: "我的账户",
  robots: { index: false, follow: false },
};

export default async function AccountPage(props: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await props.searchParams;
  const raw = Array.isArray(tab) ? tab[0] : tab;
  redirect(`/?account=${normalizeAccountTab(raw)}`);
}
