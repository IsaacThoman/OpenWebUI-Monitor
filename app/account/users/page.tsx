'use client'

import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const UsersPanel = dynamic(() => import('@/components/admin/UsersPanel'), {
    loading: () => (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    ),
    ssr: false,
})

export default function UsersPage() {
    return (
        <div className="admin-dark-theme">
            <UsersPanel />
        </div>
    )
}
