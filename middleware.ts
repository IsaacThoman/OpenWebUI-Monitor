import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { USER_PORTAL_COOKIE } from '@/lib/user-portal-constants'

const API_KEY = process.env.API_KEY

interface UserPortalSession {
    role: string
}

function setNoCacheHeaders(response: NextResponse): NextResponse {
    response.headers.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
}

function isPublicPage(pathname: string): boolean {
    return (
        pathname === '/account/login' ||
        pathname === '/token' ||
        pathname.startsWith('/u/')
    )
}

function createLoginRedirect(request: NextRequest): NextResponse {
    return NextResponse.redirect(new URL('/account/login', request.url))
}

function getUserPortalSession(request: NextRequest): UserPortalSession | null {
    const token = request.cookies.get(USER_PORTAL_COOKIE)?.value

    if (!token) {
        return null
    }

    return { role: 'unknown' }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    const legacyAdminRouteRedirects: Record<string, string> = {
        '/users': '/account/users',
        '/models': '/account/models',
        '/panel': '/account/analytics',
        '/records': '/account/analytics',
    }

    const redirectPath = legacyAdminRouteRedirects[pathname]
    if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    // Inlet/outlet endpoints use API_KEY (for OpenWebUI function calls)
    if (
        pathname.startsWith('/api/v1/inlet') ||
        pathname.startsWith('/api/v1/outlet')
    ) {
        console.log(
            `[Middleware] ${request.method} ${pathname} - Checking API_KEY auth`
        )

        if (!API_KEY) {
            console.error(
                `[Middleware] ${pathname} - Server configuration error: API_KEY is not set`
            )
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            )
        }

        const authHeader = request.headers.get('authorization')
        const providedKey = authHeader?.replace('Bearer ', '')

        if (!providedKey) {
            console.log(`[Middleware] ${pathname} - No token provided`)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (providedKey !== API_KEY) {
            console.log(`[Middleware] ${pathname} - Invalid API key`)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log(`[Middleware] ${pathname} - Authentication successful`)
        return NextResponse.next()
    }

    // Admin API endpoints — auth is handled in route handlers via cookie session
    if (
        pathname.startsWith('/api/v1/models') ||
        pathname.startsWith('/api/v1/panel') ||
        pathname.startsWith('/api/v1/config') ||
        pathname.startsWith('/api/v1/users')
    ) {
        return NextResponse.next()
    }

    // User portal API endpoints — auth handled in route handlers
    if (pathname.startsWith('/api/v1/user-portal')) {
        return NextResponse.next()
    }

    // Non-API pages
    if (!pathname.startsWith('/api/')) {
        if (isPublicPage(pathname)) {
            if (pathname === '/account/login') {
                const session = await getUserPortalSession(request)

                if (session) {
                    return NextResponse.redirect(
                        new URL('/account/personal', request.url)
                    )
                }
            }

            return NextResponse.next()
        }

        const session = getUserPortalSession(request)

        if (!session) {
            return createLoginRedirect(request)
        }

        return setNoCacheHeaders(NextResponse.next())
    }

    // Other API routes (config/key, init, etc.)
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|static/).*)'],
}
