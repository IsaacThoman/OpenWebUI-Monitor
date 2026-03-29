import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getUserByViewerToken } from '@/lib/db/users'
import {
    USER_PORTAL_COOKIE,
    getUserPortalCookieOptions,
} from '@/lib/user-portal'

export const dynamic = 'force-dynamic'

interface SessionRequestBody {
    token?: string
}

export async function POST(request: Request) {
    try {
        const { token }: SessionRequestBody = await request.json()

        if (!token?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Token is required' },
                { status: 400 }
            )
        }

        const user = await getUserByViewerToken(token.trim())

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Invalid token' },
                { status: 401 }
            )
        }

        const cookieStore = await cookies()
        cookieStore.set(
            USER_PORTAL_COOKIE,
            token.trim(),
            getUserPortalCookieOptions()
        )

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                balance: user.balance,
            },
        })
    } catch (error) {
        console.error('Failed to create user portal session:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to create session' },
            { status: 500 }
        )
    }
}

export async function DELETE() {
    const cookieStore = await cookies()
    cookieStore.delete(USER_PORTAL_COOKIE)

    return NextResponse.json({ success: true })
}
