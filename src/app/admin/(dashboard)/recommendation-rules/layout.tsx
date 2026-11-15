import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "推荐规则",
};

export default function RecommendationRulesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
