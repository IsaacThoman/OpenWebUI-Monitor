import { NextResponse } from 'next/server'

import { getUserPortalStatsForTimeRange } from '@/lib/db/users'
import { getCurrentPortalUser } from '@/lib/user-portal'

export const dynamic = 'force-dynamic'

function getTimeZone(value: string | null): string {
    if (!value) {
        return 'UTC'
    }

    try {
        Intl.DateTimeFormat(undefined, { timeZone: value })
        return value
    } catch {
        return 'UTC'
    }
}

export async function GET(request: Request) {
    try {
        const user = await getCurrentPortalUser()

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Get days parameter from URL
        const { searchParams } = new URL(request.url)
        const days = searchParams.get('days')
        const page = parseInt(searchParams.get('page') || '1', 10)
        const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
        const timeZone = getTimeZone(searchParams.get('timezone'))

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

        if (isNaN(page) || page < 1) {
            return NextResponse.json(
                { success: false, error: 'Invalid page parameter' },
                { status: 400 }
            )
        }

        if (isNaN(pageSize) || pageSize < 1) {
            return NextResponse.json(
                { success: false, error: 'Invalid pageSize parameter' },
                { status: 400 }
            )
        }

        const stats = await getUserPortalStatsForTimeRange(
            user.id,
            daysNum,
            page,
            pageSize,
            timeZone
        )

        return NextResponse.json({ success: true, data: stats })
    } catch (error) {
        console.error('Failed to fetch user portal time range stats:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch stats' },
            { status: 500 }
        )
    }
}
