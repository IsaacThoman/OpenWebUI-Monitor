import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getUserByViewerToken } from '@/lib/db/users'
import { getPublicAppUrl } from '@/lib/public-url'
import {
    USER_PORTAL_COOKIE,
    getUserPortalCookieOptions,
} from '@/lib/user-portal'

export async function GET(
    request: NextRequest,
    { params }: { params: { token: string } }
) {
    const token = params.token?.trim()
    const publicAppUrl = getPublicAppUrl(request)

    if (!token) {
        return NextResponse.redirect(
            new URL('/account/login?error=missing', publicAppUrl)
        )
    }

    const user = await getUserByViewerToken(token)

    if (!user) {
        return NextResponse.redirect(
            new URL('/account/login?error=invalid', publicAppUrl)
        )
    }

    const cookieStore = await cookies()
    cookieStore.set(USER_PORTAL_COOKIE, token, getUserPortalCookieOptions())

    return NextResponse.redirect(new URL('/account/personal', publicAppUrl))
}
