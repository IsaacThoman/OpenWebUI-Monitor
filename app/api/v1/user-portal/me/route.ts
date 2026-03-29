import { NextResponse } from 'next/server'

import { getUserPortalStats } from '@/lib/db/users'
import { getCurrentPortalUser } from '@/lib/user-portal'

export const dynamic = 'force-dynamic'

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
