import { NextResponse } from 'next/server'

const ACCESS_TOKEN = process.env.ACCESS_TOKEN
const API_KEY = process.env.API_KEY

export function verifyApiToken(req: Request) {
    if (!ACCESS_TOKEN) {
        console.error('ACCESS_TOKEN is not set')
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        )
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token || token !== ACCESS_TOKEN) {
        console.log('Unauthorized access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return null
}

export function verifyFunctionApiKey(req: Request) {
    if (!API_KEY) {
        console.error('API_KEY is not set')
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        )
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token || token !== API_KEY) {
        console.log('Unauthorized function access attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return null
}
