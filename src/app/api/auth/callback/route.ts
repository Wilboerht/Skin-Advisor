import { createCallbackRouteHandler } from "@nihplod/sso-sdk/next";

export const GET = createCallbackRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  // Skin-Advisor is a Public Client (SPA / Next.js browser flow). No clientSecret.
});
