import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that do NOT require authentication
const PUBLIC_PATHS = [
  "/admin/login",
  "/api/admin/auth/login",
  "/api/admin/setup",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // In Edge Runtime we cannot use Node crypto for full HMAC verification.
  // We perform a lightweight structural check (data.signature format)
  // and leave the cryptographic verification to server components / API routes.
  const adminSession = request.cookies.get("admin_session")?.value;

  const looksValid =
    !!adminSession &&
    adminSession.includes(".") &&
    adminSession.length > 10; // basic sanity check

  if (!looksValid) {
    if (isAdminApi) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    // Admin page — redirect to login
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
