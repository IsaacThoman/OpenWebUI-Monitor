import { NextRequest, NextResponse } from 'next/server'

import { verifyApiToken } from '@/lib/auth'
import { issueUserViewerToken } from '@/lib/db/users'

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const authError = verifyApiToken(req)
    if (authError) {
        return authError
    }

    try {
        const { token, user } = await issueUserViewerToken(params.id)
        const origin = new URL(req.url).origin

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
