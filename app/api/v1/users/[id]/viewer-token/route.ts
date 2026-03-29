import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin-auth'
import { issueUserViewerToken } from '@/lib/db/users'
import { getPublicAppUrl } from '@/lib/public-url'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { error: authError } = await requireAdmin()
    if (authError) {
        return authError
    }

    try {
        const { token, user } = await issueUserViewerToken(params.id)
        const origin = getPublicAppUrl(req)

        return NextResponse.json({
            success: true,
            data: {
                token,
                url: `${origin}/u/${token}`,
                user,
            },
        })
    } catch (error) {
        console.error('Failed to issue user viewer token:', error)
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
