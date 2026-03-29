'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, ChevronDown, Clock, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface UserPortalResponse {
    success: boolean
    error?: string
    data?: {
        profile: {
            id: string
            email: string
            name: string
            role: string
            balance: number
            viewerToken: string | null
        }
        overview: {
            totalCost: number
            totalCalls: number
            totalTokens: number
            averageCost: number
            firstUseTime: string | null
            lastUseTime: string | null
        }
    }
}

interface TimeWindowStats {
    totalCalls: number
    totalTokens: number
    totalCost: number
    averageCost: number
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all'

function formatCurrency(value: number, currencySymbol: string): string {
    return `${currencySymbol}${value.toFixed(4)}`
}

function formatNumber(value: number): string {
    return value.toLocaleString()
}

function formatDate(value: string | null, fallback: string): string {
    if (!value) {
        return fallback
    }
    return new Date(value).toLocaleString()
}

export default function PersonalPage() {
    const [data, setData] = useState<UserPortalResponse['data'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [timeRange, setTimeRange] = useState<TimeRange>('30d')
    const [stats, setStats] = useState<TimeWindowStats>({
        totalCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        averageCost: 0,
    })
    const [statsLoading, setStatsLoading] = useState(false)
    const [recentRecords, setRecentRecords] = useState<
        Array<{
            id: number
            useTime: string
            modelName: string
            totalTokens: number
            cost: number
            balanceAfter: number
        }>
    >([])
    const [topModels, setTopModels] = useState<
        Array<{
            modelName: string
            totalCost: number
            totalCalls: number
        }>
    >([])
    const router = useRouter()
    const { t } = useTranslation('common')
    const currencySymbol = t('common.currency')

    useEffect(() => {
        const loadAccount = async () => {
            try {
                const response = await fetch('/api/v1/user-portal/me')
                const payload: UserPortalResponse = await response.json()

                if (response.status === 401) {
                    router.replace('/account/login')
                    return
                }

                if (!response.ok || !payload.data) {
                    throw new Error(
                        payload.error || t('userPortal.account.loadFailed')
                    )
                }

                setData(payload.data)
            } catch (err) {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : t('userPortal.account.loadFailed')
                )
            } finally {
                setLoading(false)
            }
        }

        loadAccount()
    }, [router, t])

    const fetchTimeRangeStats = async (range: TimeRange) => {
        setStatsLoading(true)
        try {
            let days: number
            switch (range) {
                case '24h':
                    days = 1
                    break
                case '7d':
                    days = 7
                    break
                case '30d':
                    days = 30
                    break
                case '90d':
                    days = 90
                    break
                case 'all':
                    days = 0
                    break
                default:
                    days = 30
            }

            const url =
                days > 0
                    ? `/api/v1/user-portal/stats?days=${days}`
                    : '/api/v1/user-portal/stats'

            const response = await fetch(url)
            if (!response.ok) throw new Error('Failed to fetch stats')

            const result = await response.json()
            if (result.data) {
                setStats({
                    totalCalls: result.data.totalCalls || 0,
                    totalTokens: result.data.totalTokens || 0,
                    totalCost: result.data.totalCost || 0,
                    averageCost: result.data.averageCost || 0,
                })
                setRecentRecords(result.data.recentRecords || [])
                setTopModels(result.data.topModels || [])
            }
        } catch {
            // Keep existing stats on error
        } finally {
            setStatsLoading(false)
        }
    }

    useEffect(() => {
        fetchTimeRangeStats(timeRange)
    }, [timeRange])

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div>
            <div className="mb-4">
                <h1 className="text-lg font-medium">{data.profile.name}</h1>
                <p className="text-xs text-muted-foreground">
                    {data.profile.email}
                </p>
            </div>

            <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-1">
                    Current balance
                </p>
                <p className="text-2xl font-medium">
                    {formatCurrency(data.profile.balance, currencySymbol)}
                </p>
            </div>

            <div className="mb-4 border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-medium">
                            Usage overview
                        </span>
                    </div>
                    <div className="relative">
                        <select
                            value={timeRange}
                            onChange={(e) =>
                                setTimeRange(e.target.value as TimeRange)
                            }
                            className="appearance-none bg-background border px-2 py-1 pr-6 text-xs focus:outline-none"
                        >
                            <option value="24h">24 hours</option>
                            <option value="7d">7 days</option>
                            <option value="30d">30 days</option>
                            <option value="90d">90 days</option>
                            <option value="all">All time</option>
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x">
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            Calls
                        </p>
                        <p className="text-lg font-medium">
                            {statsLoading
                                ? '-'
                                : formatNumber(stats.totalCalls)}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            Tokens
                        </p>
                        <p className="text-lg font-medium">
                            {statsLoading
                                ? '-'
                                : formatNumber(stats.totalTokens)}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            Spend
                        </p>
                        <p className="text-lg font-medium">
                            {statsLoading
                                ? '-'
                                : formatCurrency(
                                      stats.totalCost,
                                      currencySymbol
                                  )}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            Avg per call
                        </p>
                        <p className="text-lg font-medium">
                            {statsLoading
                                ? '-'
                                : formatCurrency(
                                      stats.averageCost,
                                      currencySymbol
                                  )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="border">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Zap className="h-3 w-3" />
                                <h2 className="text-xs font-medium">
                                    Recent usage
                                </h2>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {recentRecords.length} records
                            </span>
                        </div>

                        {recentRecords.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b text-left text-muted-foreground">
                                            <th className="px-3 py-2 font-normal">
                                                Time
                                            </th>
                                            <th className="px-3 py-2 font-normal">
                                                Model
                                            </th>
                                            <th className="px-3 py-2 font-normal">
                                                Tokens
                                            </th>
                                            <th className="px-3 py-2 font-normal">
                                                Cost
                                            </th>
                                            <th className="px-3 py-2 font-normal text-right">
                                                Balance after
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {recentRecords.map((record) => (
                                            <tr key={record.id}>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                                    {formatDate(
                                                        record.useTime,
                                                        '-'
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className="block max-w-[150px] truncate"
                                                        title={record.modelName}
                                                    >
                                                        {record.modelName}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {formatNumber(
                                                        record.totalTokens
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {formatCurrency(
                                                        record.cost,
                                                        currencySymbol
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {formatCurrency(
                                                        record.balanceAfter,
                                                        currencySymbol
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="border">
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                            <BarChart3 className="h-3 w-3" />
                            <h2 className="text-xs font-medium">Top models</h2>
                        </div>

                        {topModels.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {topModels.map((model, index) => (
                                    <div
                                        key={model.modelName}
                                        className="flex items-center justify-between gap-2 px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-xs text-muted-foreground">
                                                {index + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className="truncate text-xs"
                                                    title={model.modelName}
                                                >
                                                    {model.modelName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatNumber(
                                                        model.totalCalls
                                                    )}{' '}
                                                    calls
                                                </p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs">
                                            {formatCurrency(
                                                model.totalCost,
                                                currencySymbol
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
