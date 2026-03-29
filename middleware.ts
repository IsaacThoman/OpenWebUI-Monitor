import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { USER_PORTAL_COOKIE } from '@/lib/user-portal-constants'

const API_KEY = process.env.API_KEY
const ADMIN_PAGE_PATHS = new Set(['/models', '/panel', '/records', '/users'])
const ADMIN_PAGE_PREFIXES = [
    '/account/analytics',
    '/account/models',
    '/account/users',
]

interface UserPortalSession {
    role: string
}

interface UserPortalMeResponse {
    success: boolean
    data?: {
        profile?: {
            role?: string
        }
    }
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

function isAdminPage(pathname: string): boolean {
    return (
        ADMIN_PAGE_PATHS.has(pathname) ||
        ADMIN_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    )
}

function createLoginRedirect(request: NextRequest): NextResponse {
    return NextResponse.redirect(new URL('/account/login', request.url))
}

async function getUserPortalSession(
    request: NextRequest
): Promise<UserPortalSession | null> {
    const token = request.cookies.get(USER_PORTAL_COOKIE)?.value

    if (!token) {
        return null
    }

    try {
        const response = await fetch(new URL('/api/v1/user-portal/me', request.url), {
            headers: {
                accept: 'application/json',
                cookie: request.headers.get('cookie') ?? '',
            },
            cache: 'no-store',
        })

        if (!response.ok) {
            return null
        }

        const payload: UserPortalMeResponse = await response.json()
        const role = payload.data?.profile?.role

        if (!role) {
            return null
        }

        return { role }
    } catch (error) {
        console.error('[Middleware] Failed to validate user portal session:', error)
        return null
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

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

        const session = await getUserPortalSession(request)

        if (!session) {
            return createLoginRedirect(request)
        }

        if (isAdminPage(pathname) && session.role !== 'admin') {
            return NextResponse.redirect(new URL('/account/personal', request.url))
        }

        return setNoCacheHeaders(NextResponse.next())
    }

    // Other API routes (config/key, init, etc.)
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
