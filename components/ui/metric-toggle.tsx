'use client'

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { DollarOutlined, BarChartOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

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
                'flex gap-1 w-full sm:w-[300px] p-1.5 rounded-lg border',
                'bg-slate-900/60 border-slate-700/50',
                'shadow-[0_2px_12px_-2px_rgba(0,0,0,0.2)]',
                className
            )}
        >
            <motion.button
                onClick={() => onChange('cost')}
                className={cn(
                    'relative flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md',
                    'transition-colors duration-200',
                    value === 'cost'
                        ? 'text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                )}
            >
                {value === 'cost' && (
                    <motion.div
                        layoutId="activeBg"
                        className="absolute inset-0 bg-slate-700/70 border border-slate-600/50 rounded-md shadow-sm"
                        initial={false}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                    />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                    <DollarOutlined className="text-[14px]" />
                    {t('panel.byAmount')}
                </span>
            </motion.button>

            <motion.button
                onClick={() => onChange('count')}
                className={cn(
                    'relative flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md',
                    'transition-colors duration-200',
                    value === 'count'
                        ? 'text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                )}
            >
                {value === 'count' && (
                    <motion.div
                        layoutId="activeBg"
                        className="absolute inset-0 bg-slate-700/70 border border-slate-600/50 rounded-md shadow-sm"
                        initial={false}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                    />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                    <BarChartOutlined className="text-[14px]" />
                    {t('panel.byCount')}
                </span>
            </motion.button>
        </div>
    )
}
