import { NextResponse } from 'next/server'

import { getLeaderboardStats } from '@/lib/db/users'
import { getCurrentPortalUser } from '@/lib/user-portal'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const user = await getCurrentPortalUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const days = searchParams.get('days')

        let daysNum: number | undefined
        if (days) {
            daysNum = parseInt(days, 10)
            if (isNaN(daysNum) || daysNum < 1) {
                return NextResponse.json(
                    { success: false, error: 'Invalid days parameter' },
                    { status: 400 }
                )
            }
        }

        const stats = await getLeaderboardStats(daysNum)

        return NextResponse.json({ success: true, data: stats })
    } catch (error) {
        console.error('Failed to fetch leaderboard stats:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch leaderboard stats' },
            { status: 500 }
        )
    }
}
