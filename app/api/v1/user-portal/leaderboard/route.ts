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
        const page = searchParams.get('page')
        const pageSize = searchParams.get('pageSize')

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

        let pageNum = 1
        if (page) {
            pageNum = parseInt(page, 10)
            if (isNaN(pageNum) || pageNum < 1) {
                return NextResponse.json(
                    { success: false, error: 'Invalid page parameter' },
                    { status: 400 }
                )
            }
        }

        let pageSizeNum = 100
        if (pageSize) {
            pageSizeNum = parseInt(pageSize, 10)
            if (isNaN(pageSizeNum) || pageSizeNum < 1) {
                return NextResponse.json(
                    { success: false, error: 'Invalid pageSize parameter' },
                    { status: 400 }
                )
            }
        }

        const stats = await getLeaderboardStats(daysNum, pageNum, pageSizeNum)

        return NextResponse.json({ success: true, data: stats })
    } catch (error) {
        console.error('Failed to fetch leaderboard stats:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch leaderboard stats' },
            { status: 500 }
        )
    }
}
