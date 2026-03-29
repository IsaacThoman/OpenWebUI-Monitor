import { NextResponse } from 'next/server'

const ACCESS_TOKEN = process.env.ACCESS_TOKEN
const API_KEY = process.env.API_KEY

export function verifyApiToken(req: Request) {
    console.log(`[Auth] verifyApiToken called`)

    if (!ACCESS_TOKEN) {
        console.error('[Auth] ACCESS_TOKEN is not set in environment')
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        )
    }

    const authHeader = req.headers.get('authorization')
    console.log(`[Auth] Authorization header present: ${!!authHeader}`)

    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
        console.log('[Auth] No token provided in request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (token !== ACCESS_TOKEN) {
        console.log(
            `[Auth] Token mismatch (provided: ${token.substring(0, 4)}...${token.slice(-4)}, expected: ${ACCESS_TOKEN.substring(0, 4)}...${ACCESS_TOKEN.slice(-4)})`
        )
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Auth] Token verified successfully')
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
