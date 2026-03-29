'use client'

import { usePathname } from 'next/navigation'

export default function Header() {
    const pathname = usePathname()

    // Header is no longer needed — the account page has its own navigation
    // Only the standalone admin pages (used in iframes) might render,
    // but they don't need a header in that context either
    if (
        pathname.startsWith('/account') ||
        pathname === '/token' ||
        pathname.startsWith('/u/')
    ) {
        return null
    }

    // For standalone admin pages (models, users, panel, records)
    // rendered inside iframes in the account page, no header needed
    return null
}
