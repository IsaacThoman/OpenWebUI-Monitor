'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TokenPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/account/login')
    }, [router])

    return null
}
