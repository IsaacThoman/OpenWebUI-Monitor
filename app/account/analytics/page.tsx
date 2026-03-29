'use client'

import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const AnalyticsPanel = dynamic(
    () => import('@/components/admin/AnalyticsPanel'),
    {
        loading: () => (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        ),
        ssr: false,
    }
)

export default function AnalyticsPage() {
    return (
        <div className="admin-dark-theme">
            <AnalyticsPanel />
        </div>
    )
}
