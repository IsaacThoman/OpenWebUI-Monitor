import { Loader2 } from 'lucide-react'

export default function AccountLoading() {
    return (
        <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
            </div>
        </div>
    )
}
