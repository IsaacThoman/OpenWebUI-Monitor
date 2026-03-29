import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: Request) {
    const { error: authError } = await requireAdmin()
    if (authError) {
        return authError
    }

    return NextResponse.json({
        apiKey: process.env.API_KEY || 'Unconfigured',
        status: 200,
    })
}
