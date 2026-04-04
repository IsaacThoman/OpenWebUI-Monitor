import { NextResponse } from 'next/server'

import { query } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        await query('SELECT 1')

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error('Health check failed:', error)

        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Database unavailable',
            },
            { status: 503 }
        )
    }
}
