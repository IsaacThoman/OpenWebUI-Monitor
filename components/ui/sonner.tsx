'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = 'system' } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps['theme']}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:rounded-none group-[.toaster]:shadow-none',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton:
                        'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-none group-[.toast]:shadow-none',
                    cancelButton:
                        'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-none group-[.toast]:shadow-none',
                    closeButton:
                        'group-[.toast]:rounded-none group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-muted-foreground',
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
