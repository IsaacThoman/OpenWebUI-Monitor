'use client'

import { useCallback, useEffect, useState, type UIEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Clock, Info, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import DailyUsageChart from '@/components/panel/DailyUsageChart'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
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

const RECENT_RECORDS_PAGE_SIZE = 100

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
    return new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    })
}

function formatDateOnly(value: string | null, fallback: string): string {
    if (!value) {
        return fallback
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return fallback
    }

    const monthNames = [
        'Jan.',
        'Feb.',
        'Mar.',
        'Apr.',
        'May',
        'Jun.',
        'Jul.',
        'Aug.',
        'Sep.',
        'Oct.',
        'Nov.',
        'Dec.',
    ]

    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

function getSelectedPeriodDayCount(
    range: TimeRange,
    firstUseTime: string | null
): number {
    switch (range) {
        case '24h':
            return 1
        case '7d':
            return 7
        case '30d':
            return 30
        case '90d':
            return 90
        case 'all': {
            if (!firstUseTime) {
                return 0
            }

            const start = new Date(firstUseTime)
            const today = new Date()
            const startOfFirstDay = new Date(
                start.getFullYear(),
                start.getMonth(),
                start.getDate()
            )
            const startOfToday = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
            )
            const diffMs = startOfToday.getTime() - startOfFirstDay.getTime()

            return Math.max(1, Math.floor(diffMs / 86400000) + 1)
        }
    }
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
    const [recentRecordsPage, setRecentRecordsPage] = useState(1)
    const [recentRecordsTotal, setRecentRecordsTotal] = useState(0)
    const [recentRecordsLoadingMore, setRecentRecordsLoadingMore] =
        useState(false)
    const [topModels, setTopModels] = useState<
        Array<{
            modelName: string
            totalCost: number
            totalCalls: number
        }>
    >([])
    const [dailyUsage, setDailyUsage] = useState<
        Array<{
            date: string
            totalCost: number
            totalTokens: number
            totalCalls: number
            models: Array<{
                name: string
                cost: number
                tokens: number
                calls: number
            }>
        }>
    >([])
    const [dailyUsageMetric, setDailyUsageMetric] = useState<
        'cost' | 'tokens' | 'calls'
    >('cost')
    const [contributionData, setContributionData] = useState<
        Array<{
            date: string
            totalCost: number
            totalTokens: number
            totalCalls: number
            models: Array<{
                name: string
                cost: number
                tokens: number
                calls: number
            }>
        }>
    >([])
    const [contributionLoading, setContributionLoading] = useState(true)
    const [browserTimeZone, setBrowserTimeZone] = useState<string | null>(null)
    const router = useRouter()
    const { t } = useTranslation('common')
    const currencySymbol = t('common.currency')

    useEffect(() => {
        setBrowserTimeZone(
            Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        )
    }, [])

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

    const fetchTimeRangeStats = useCallback(
        async (range: TimeRange, page: number, append = false) => {
            if (append) {
                setRecentRecordsLoadingMore(true)
            } else {
                setStatsLoading(true)
            }

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

                const params = new URLSearchParams({
                    page: String(page),
                    pageSize: String(RECENT_RECORDS_PAGE_SIZE),
                })

                if (days > 0) {
                    params.set('days', String(days))
                }

                params.set('timezone', browserTimeZone || 'UTC')

                const url = `/api/v1/user-portal/stats?${params.toString()}`

                const response = await fetch(url)
                if (!response.ok) throw new Error('Failed to fetch stats')

                const result = await response.json()
                if (result.data) {
                    const nextRecords = result.data.recentRecords || []

                    if (append) {
                        setRecentRecords((currentRecords) => [
                            ...currentRecords,
                            ...nextRecords,
                        ])
                    } else {
                        setStats({
                            totalCalls: result.data.totalCalls || 0,
                            totalTokens: result.data.totalTokens || 0,
                            totalCost: result.data.totalCost || 0,
                            averageCost: result.data.averageCost || 0,
                        })
                        setRecentRecords(nextRecords)
                        setTopModels(result.data.topModels || [])
                        setDailyUsage(result.data.dailyUsage || [])
                    }

                    setRecentRecordsPage(page)
                    setRecentRecordsTotal(
                        result.data.recentRecordsPagination?.total || 0
                    )
                }
            } catch {
                // Keep existing stats on error
            } finally {
                if (append) {
                    setRecentRecordsLoadingMore(false)
                } else {
                    setStatsLoading(false)
                }
            }
        },
        [browserTimeZone]
    )

    useEffect(() => {
        if (!browserTimeZone) {
            return
        }

        fetchTimeRangeStats(timeRange, 1)
    }, [browserTimeZone, fetchTimeRangeStats, timeRange])

    // Fetch full year of daily data for the contribution graph
    useEffect(() => {
        const fetchContributionData = async () => {
            if (!browserTimeZone) {
                return
            }

            setContributionLoading(true)
            try {
                const params = new URLSearchParams({
                    days: '365',
                    page: '1',
                    pageSize: '1',
                    timezone: browserTimeZone,
                })
                const response = await fetch(
                    `/api/v1/user-portal/stats?${params.toString()}`
                )
                if (!response.ok) throw new Error('Failed to fetch')
                const result = await response.json()
                if (result.data?.dailyUsage) {
                    setContributionData(result.data.dailyUsage)
                }
            } catch {
                // Keep empty on error
            } finally {
                setContributionLoading(false)
            }
        }
        fetchContributionData()
    }, [browserTimeZone])

    const selectedPeriodDayCount = getSelectedPeriodDayCount(
        timeRange,
        data?.overview.firstUseTime ?? null
    )
    const hasMoreRecentRecords = recentRecords.length < recentRecordsTotal

    const handleTimeRangeChange = (nextRange: TimeRange) => {
        setTimeRange(nextRange)
        setRecentRecordsPage(1)
        setRecentRecords([])
        setRecentRecordsTotal(0)
    }

    const loadMoreRecentRecords = useCallback(() => {
        if (
            statsLoading ||
            recentRecordsLoadingMore ||
            !hasMoreRecentRecords
        ) {
            return
        }

        fetchTimeRangeStats(timeRange, recentRecordsPage + 1, true)
    }, [
        fetchTimeRangeStats,
        hasMoreRecentRecords,
        recentRecordsLoadingMore,
        recentRecordsPage,
        statsLoading,
        timeRange,
    ])

    const handleRecentRecordsScroll = (event: UIEvent<HTMLDivElement>) => {
        const { clientHeight, scrollHeight, scrollTop } = event.currentTarget

        if (scrollHeight - scrollTop - clientHeight < 160) {
            loadMoreRecentRecords()
        }
    }

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
                <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                        {data.profile.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        · Joined{' '}
                        {formatDateOnly(
                            data.overview.firstUseTime,
                            t('userPortal.account.never')
                        )}
                    </p>
                </div>
            </div>

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:gap-0">
                <div className="min-w-[170px] md:pr-5">
                    <p className="mb-1 text-xs text-muted-foreground">
                        {t('userPortal.account.cards.balance')}
                    </p>
                    <p className="text-2xl font-medium">
                        {formatCurrency(data.profile.balance, currencySymbol)}
                    </p>
                </div>
            </div>

            <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs font-medium">
                                Usage overview
                            </span>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex gap-1">
                            <Button
                                variant={
                                    dailyUsageMetric === 'cost'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setDailyUsageMetric('cost')}
                            >
                                USD
                            </Button>
                            <Button
                                variant={
                                    dailyUsageMetric === 'tokens'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setDailyUsageMetric('tokens')}
                            >
                                Tokens
                            </Button>
                            <Button
                                variant={
                                    dailyUsageMetric === 'calls'
                                        ? 'default'
                                        : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setDailyUsageMetric('calls')}
                            >
                                Calls
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant={
                                timeRange === '24h' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleTimeRangeChange('24h')}
                        >
                            24h
                        </Button>
                        <Button
                            variant={timeRange === '7d' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleTimeRangeChange('7d')}
                        >
                            7d
                        </Button>
                        <Button
                            variant={
                                timeRange === '30d' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleTimeRangeChange('30d')}
                        >
                            30d
                        </Button>
                        <Button
                            variant={
                                timeRange === '90d' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleTimeRangeChange('90d')}
                        >
                            90d
                        </Button>
                        <Button
                            variant={
                                timeRange === 'all' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleTimeRangeChange('all')}
                        >
                            All
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 md:gap-0 md:divide-x">
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
                    <div className="p-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                        Water use
                                        <Info className="h-3 w-3" />
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-[300px]">
                                        Based on Altman&apos;s estimate where a
                                        query uses 1/15 tsp of water & assumes
                                        typical prompt cost ~$0.002 (common
                                        medical question to gpt-5 mini in flex
                                        mode)
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <p className="text-lg font-medium">
                            {statsLoading
                                ? '-'
                                : `${(stats.totalCost / 23.04).toFixed(4)} Gal`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <DailyUsageChart
                    loading={statsLoading}
                    data={dailyUsage}
                    periodDayCount={selectedPeriodDayCount}
                    metric={dailyUsageMetric}
                    onMetricChange={setDailyUsageMetric}
                    contributionData={contributionData}
                    contributionLoading={contributionLoading}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="border" id="recent-usage">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Zap className="h-3 w-3" />
                                <h2 className="text-xs font-medium">
                                    Recent usage
                                </h2>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Showing {formatNumber(recentRecords.length)} of{' '}
                                {formatNumber(recentRecordsTotal)} records
                            </span>
                        </div>

                        {statsLoading && recentRecords.length === 0 ? (
                            <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading usage
                            </div>
                        ) : recentRecords.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div
                                className="max-h-96 overflow-auto"
                                onScroll={handleRecentRecordsScroll}
                            >
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-background">
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

                                {recentRecordsLoadingMore ? (
                                    <div className="flex items-center justify-center gap-2 border-t px-3 py-3 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading more
                                    </div>
                                ) : null}
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
                            <div className="max-h-96 divide-y overflow-y-auto">
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
