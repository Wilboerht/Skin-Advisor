import type { Metadata } from "next";

/**
 * Default Open Graph / social sharing image used across the site.
 * Safari's Start Page "Suggestions" cards also pick this up via og:image.
 */
export const defaultOpenGraphImage = {
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "NIHPLOD AI 护肤顾问",
};

/**
 * Helper to merge page-specific metadata with the default OG image.
 * Next.js does NOT automatically inherit `openGraph.images` from the root layout
 * when a child page defines its own `openGraph` object, so we explicitly add it.
 */
export function withDefaultOgImage(metadata: Metadata): Metadata {
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: metadata.openGraph?.images ?? [defaultOpenGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      ...metadata.twitter,
      images: metadata.twitter?.images ?? [defaultOpenGraphImage.url],
    },
  };
}
