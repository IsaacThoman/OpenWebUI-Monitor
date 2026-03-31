import { NextResponse } from 'next/server'

import { LEADERBOARD_BAR_COLORS } from '@/lib/user-portal-constants'
import {
    getUserPortalStats,
    updateUserLeaderboardPreferences,
} from '@/lib/db/users'
import { getCurrentPortalUser } from '@/lib/user-portal'

export const dynamic = 'force-dynamic'

interface UpdateLeaderboardPreferencesRequestBody {
    showNameOnLeaderboard?: boolean
    leaderboardNickname?: string | null
    leaderboardColor?: string
}

export async function GET() {
    try {
        const user = await getCurrentPortalUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const stats = await getUserPortalStats(user.id)

        if (!stats) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: stats })
    } catch (error) {
        console.error('Failed to fetch user portal stats:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch account stats' },
            { status: 500 }
        )
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getCurrentPortalUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const {
            showNameOnLeaderboard,
            leaderboardNickname,
            leaderboardColor,
        }: UpdateLeaderboardPreferencesRequestBody = await request.json()

        if (typeof showNameOnLeaderboard !== 'boolean') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'showNameOnLeaderboard must be a boolean',
                },
                { status: 400 }
            )
        }

        if (
            leaderboardNickname !== undefined &&
            leaderboardNickname !== null &&
            typeof leaderboardNickname !== 'string'
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'leaderboardNickname must be a string',
                },
                { status: 400 }
            )
        }

        if (
            leaderboardColor !== undefined &&
            !LEADERBOARD_BAR_COLORS.includes(
                leaderboardColor as (typeof LEADERBOARD_BAR_COLORS)[number]
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'leaderboardColor must be a supported color',
                },
                { status: 400 }
            )
        }

        const normalizedNickname = leaderboardNickname?.trim() || null

        if (normalizedNickname && normalizedNickname.length > 40) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Leaderboard nickname must be 40 characters or less',
                },
                { status: 400 }
            )
        }

        const preferences = await updateUserLeaderboardPreferences(user.id, {
            showNameOnLeaderboard,
            leaderboardNickname:
                normalizedNickname && normalizedNickname !== user.name.trim()
                    ? normalizedNickname
                    : null,
            leaderboardColor: leaderboardColor || LEADERBOARD_BAR_COLORS[0],
        })

        return NextResponse.json({ success: true, data: preferences })
    } catch (error) {
        console.error('Failed to update leaderboard preferences:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update leaderboard preferences',
            },
            { status: 500 }
        )
    }
}
