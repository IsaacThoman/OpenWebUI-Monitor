import { NextResponse } from 'next/server'

import { verifyFunctionApiKey } from '@/lib/auth'
import { getOrCreateUser, getOrCreateUserViewerToken } from '@/lib/db/users'

export const dynamic = 'force-dynamic'

interface LinkRequestBody {
    user?: {
        id?: string
        email?: string
        name?: string
        role?: string
    }
}

export async function POST(request: Request) {
    const authError = verifyFunctionApiKey(request)
    if (authError) {
        return authError
    }

    try {
        const { user }: LinkRequestBody = await request.json()

        if (!user?.id || !user.email || !user.name) {
            return NextResponse.json(
                { success: false, error: 'Valid user payload is required' },
                { status: 400 }
            )
        }

        const ensuredUser = await getOrCreateUser({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        })
        const { token } = await getOrCreateUserViewerToken(ensuredUser.id)
        const origin = new URL(request.url).origin

        return NextResponse.json({
            success: true,
            data: {
                token,
                url: `${origin}/u/${token}`,
            },
        })
    } catch (error) {
        console.error('Failed to create self-service stats link:', error)
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create stats link',
            },
            { status: 500 }
        )
    }
}
