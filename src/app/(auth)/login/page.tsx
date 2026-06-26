
import { redirect } from "next/navigation";

export default async function LoginPage(props: {
    searchParams: Promise<{ redirect?: string }>;
}) {
    const params = await props.searchParams;
    const redirectParam = params.redirect;
    const target = redirectParam
        ? `/?auth=login&redirect=${encodeURIComponent(redirectParam)}`
        : "/?auth=login";
    redirect(target);
}
