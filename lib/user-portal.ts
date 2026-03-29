import { cookies } from 'next/headers'

import { getUserByViewerToken } from '@/lib/db/users'
import { USER_PORTAL_COOKIE } from '@/lib/user-portal-constants'

function isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
}

export function getUserPortalCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: isProduction(),
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    }
}

export async function getCurrentPortalUser() {
    const cookieStore = await cookies()
    const token = cookieStore.get(USER_PORTAL_COOKIE)?.value

    if (!token) {
        return null
    }

    return getUserByViewerToken(token)
}
