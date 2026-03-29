'use client'

import { useEffect } from 'react'

export default function AuthCheck({ children }: { children: React.ReactNode }) {
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

    return <>{children}</>
}
