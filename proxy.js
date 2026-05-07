import { NextResponse } from 'next/server';

export function proxy(request) {
    const { pathname } = request.nextUrl;

    // Allow login page to be accessed without authentication
    if (pathname === '/login') {
        return NextResponse.next();
    }

    // Allow public assets
    if (pathname.startsWith('/_next') || pathname.startsWith('/public')) {
        return NextResponse.next();
    }

    // Protect dashboard routes
    if (pathname.startsWith('/dashboard')) {
        // In a real app, you'd check the auth token here
        // For now, this proxy is just a placeholder
        // Authentication is handled by the AuthProvider
        return NextResponse.next();
    }

    // Redirect root to login
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
