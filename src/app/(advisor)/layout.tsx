import type { Metadata } from "next";
import { AdvisorLayoutClient } from "./AdvisorLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdvisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdvisorLayoutClient>{children}</AdvisorLayoutClient>;
}
