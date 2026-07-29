import { createLogoutRouteHandler } from "@nihplod/sso-sdk/next";

const handler = createLogoutRouteHandler({
  clientId: process.env.NEXT_PUBLIC_SSO_CLIENT_ID!,
  ssoBaseUrl: process.env.NEXT_PUBLIC_SSO_BASE_URL!,
  redirectUri: process.env.NEXT_PUBLIC_SSO_REDIRECT_URI!,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_BASE_URL || "https://advisor.nihplod.cn",
  // Public Client: no clientSecret
  redirectToSso: true,
});

export const GET = handler;
export const POST = handler;
