'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export default function AuthCheck({ children }: { children: React.ReactNode }) {
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const initDb = async () => {
            try {
                await fetch('/api/init')
            } catch (error) {
                console.error('Failed to initialize database:', error)
            }
        }

        initDb()
    }, [])

    useEffect(() => {
        const checkAuth = async () => {
            // Allow login page and auto-login link pages through without auth
            if (
                pathname.startsWith('/account/login') ||
                pathname.startsWith('/u/')
            ) {
                setIsLoading(false)
                setIsAuthorized(true)
                return
            }

            // All other pages require user portal session (cookie-based)
            try {
                const res = await fetch('/api/v1/user-portal/me')

                if (!res.ok) {
                    router.push('/account/login')
                    return
                }

                setIsAuthorized(true)
            } catch (error) {
                router.push('/account/login')
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [router, pathname])

    if (isLoading || !isAuthorized) {
        return null
    }

    return <>{children}</>
}
