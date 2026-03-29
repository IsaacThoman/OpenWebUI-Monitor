import { NextResponse } from 'next/server'

import { getCurrentPortalUser } from '@/lib/user-portal'

export async function requireAdmin() {
    const user = await getCurrentPortalUser()

    if (!user) {
        return {
            user: null,
            error: NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            ),
        }
    }

    if (user.role !== 'admin') {
        return {
            user: null,
            error: NextResponse.json(
                { success: false, error: 'Forbidden: admin access required' },
                { status: 403 }
            ),
        }
    }

    return { user, error: null }
}
