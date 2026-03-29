'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface MetricSwitchProps {
    value: 'cost' | 'count'
    onChange: (value: 'cost' | 'count') => void
    className?: string
}

export function MetricSwitch({
    value,
    onChange,
    className,
}: MetricSwitchProps) {
    const { t } = useTranslation('common')

    return (
        <div
            className={cn(
                'inline-flex h-9 items-center bg-muted p-1',
                className
            )}
        >
            <div className="relative flex items-center gap-1">
                <button
                    onClick={() => onChange('cost')}
                    className={cn(
                        'relative px-3 py-1 text-sm font-medium transition-colors duration-200',
                        value === 'cost'
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground'
                    )}
                >
                    {t('panel.byAmount')}
                </button>
                <button
                    onClick={() => onChange('count')}
                    className={cn(
                        'relative px-3 py-1 text-sm font-medium transition-colors duration-200',
                        value === 'count'
                            ? 'bg-background text-foreground'
                            : 'text-muted-foreground'
                    )}
                >
                    {t('panel.byCount')}
                </button>
            </div>
        </div>
    )
}
