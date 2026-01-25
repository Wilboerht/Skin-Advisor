
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Define protected paths
    const isAdminPath = pathname.startsWith('/admin');
    const isAdminApi = pathname.startsWith('/api/admin');

    // Define public paths within admin
    // Define public paths within admin
    const isLoginPage = pathname === '/admin/login';
    const isLoginApi = pathname === '/api/admin/auth/login';

    // If it's the login page or login API, allow access
    if (isLoginPage || isLoginApi) {
        return NextResponse.next();
    }

    // Check for admin session cookie
    const adminSession = request.cookies.get('admin_session');

    if (isAdminPath || isAdminApi) {
        if (!adminSession) {
            if (isAdminApi) {
                return NextResponse.json(
                    { success: false, error: 'Unauthorized' },
                    { status: 401 }
                );
            } else {
                return NextResponse.redirect(new URL('/admin/login', request.url));
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*',
    ],
};
