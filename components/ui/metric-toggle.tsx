'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { DollarOutlined, BarChartOutlined } from '@ant-design/icons'

interface MetricToggleProps {
    value: 'cost' | 'count'
    onChange: (value: 'cost' | 'count') => void
    className?: string
}

export function MetricToggle({
    value,
    onChange,
    className,
}: MetricToggleProps) {
    const { t } = useTranslation('common')

    return (
        <div
            className={cn(
                'flex gap-1 w-full sm:w-[240px] p-1 border',
                'bg-muted border-border',
                className
            )}
        >
            <button
                onClick={() => onChange('cost')}
                className={cn(
                    'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                    'transition-colors',
                    value === 'cost'
                        ? 'bg-background text-foreground border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                <DollarOutlined className="text-[12px]" />
                {t('panel.byAmount')}
            </button>

            <button
                onClick={() => onChange('count')}
                className={cn(
                    'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                    'transition-colors',
                    value === 'count'
                        ? 'bg-background text-foreground border border-border'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                <BarChartOutlined className="text-[12px]" />
                {t('panel.byCount')}
            </button>
        </div>
    )
}
