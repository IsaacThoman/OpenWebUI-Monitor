'use client'

import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ECharts } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { BarChart3, Clock, Crown, Loader2, Save, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    DEFAULT_LEADERBOARD_BAR_COLOR,
    LEADERBOARD_BAR_COLORS,
} from '@/lib/user-portal-constants'
import { cn } from '@/lib/utils'

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
            createdAt: string | null
            showNameOnLeaderboard: boolean
            leaderboardNickname: string | null
            leaderboardColor: string | null
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

interface MostExpensiveCall {
    userId: string
    displayName: string
    isAnonymous: boolean
    modelName: string
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
    useTime: string
}

interface LeaderboardResponse {
    success: boolean
    error?: string
    data?: {
        totalCalls: number
        totalTokens: number
        totalCost: number
        averageCost: number
        users: Array<{
            userId: string
            displayName: string
            isAnonymous: boolean
            leaderboardColor: string | null
            totalCalls: number
            totalTokens: number
            totalCost: number
            averageCost: number
        }>
        topModels: Array<{
            modelName: string
            totalCost: number
            totalCalls: number
        }>
        recentRecords: Array<{
            id: number
            useTime: string
            modelName: string
            totalTokens: number
            cost: number
            balanceAfter: number
            displayName: string
            isAnonymous: boolean
        }>
        recentRecordsPagination: {
            page: number
            pageSize: number
            total: number
            totalPages: number
        }
        mostExpensiveCall: MostExpensiveCall | null
    }
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all'
type LeaderboardMetric = 'cost' | 'tokens' | 'calls' | 'water'

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

function getDaysForRange(range: TimeRange): number {
    switch (range) {
        case '24h':
            return 1
        case '7d':
            return 7
        case '30d':
            return 30
        case '90d':
            return 90
        case 'all':
            return 0
    }
}

function normalizeLeaderboardNickname(
    value: string,
    accountName: string
): string | null {
    const trimmedValue = value.trim()

    if (!trimmedValue || trimmedValue === accountName.trim()) {
        return null
    }

    return trimmedValue
}

function getMetricValue(
    user: NonNullable<LeaderboardResponse['data']>['users'][number],
    metric: LeaderboardMetric
): number {
    if (metric === 'tokens') {
        return user.totalTokens
    }

    if (metric === 'calls') {
        return user.totalCalls
    }

    if (metric === 'water') {
        return user.totalCost / 23.04
    }

    return user.totalCost
}

function formatMetricValue(
    value: number,
    metric: LeaderboardMetric,
    currencySymbol: string
): string {
    if (metric === 'cost') {
        return formatCurrency(value, currencySymbol)
    }

    if (metric === 'water') {
        return `${value.toFixed(4)} Gal`
    }

    return formatNumber(value)
}

function getLeaderboardChartOption(
    users: NonNullable<LeaderboardResponse['data']>['users'],
    metric: LeaderboardMetric,
    currencySymbol: string
) {
    const isSmallScreen = window.innerWidth < 640

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
            },
            backgroundColor: 'hsl(220 15% 12%)',
            borderColor: 'hsl(220 15% 18%)',
            borderWidth: 1,
            padding: [12, 16],
            textStyle: {
                color: 'hsl(220 15% 90%)',
                fontSize: 12,
                lineHeight: 18,
            },
            formatter: (
                params: Array<{ dataIndex?: number; value: number }>
            ) => {
                const dataIndex = params[0]?.dataIndex ?? 0
                const user = users[dataIndex]
                const value = params[0]?.value ?? 0

                return `
          <div class="flex flex-col gap-1">
            <div class="font-medium" style="color: hsl(220 15% 90%)">#${dataIndex + 1} ${user.displayName}</div>
            <div class="flex items-center gap-2">
              <span class="text-xs" style="color: hsl(220 15% 55%)">${metric === 'cost' ? 'USD' : metric === 'tokens' ? 'Tokens' : metric === 'water' ? 'Water' : 'Calls'}</span>
              <span class="font-mono text-sm font-medium" style="color: hsl(220 15% 90%)">${formatMetricValue(value, metric, currencySymbol)}</span>
            </div>
          </div>
        `
            },
        },
        grid: {
            top: 12,
            bottom: isSmallScreen ? 90 : 70,
            left: '4%',
            right: '4%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: users.map((user) => user.displayName),
            axisLabel: {
                inside: false,
                color: 'hsl(220 15% 55%)',
                fontSize: 11,
                interval: 0,
                rotate: users.length > 8 || isSmallScreen ? 35 : 0,
                hideOverlap: false,
                width: 84,
                overflow: 'truncate',
            },
            axisTick: {
                show: false,
            },
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
        },
        yAxis: {
            type: 'value',
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
            axisLabel: {
                color: 'hsl(220 15% 55%)',
                fontSize: 11,
                formatter: (value: number) => {
                    if (metric === 'cost') {
                        return `${currencySymbol}${value.toFixed(1)}`
                    }

                    if (metric === 'water') {
                        return `${value.toFixed(2)}`
                    }

                    if (value >= 1000) {
                        return `${(value / 1000).toFixed(1)}k`
                    }

                    return `${Math.round(value)}`
                },
            },
        },
        series: [
            {
                type: 'bar',
                barWidth: users.length > 14 ? '50%' : '60%',
                data: users.map((user) => ({
                    value: getMetricValue(user, metric),
                    itemStyle: {
                        color: user.isAnonymous
                            ? 'hsl(220 15% 75%)'
                            : user.leaderboardColor ||
                              DEFAULT_LEADERBOARD_BAR_COLOR,
                        borderRadius: [3, 3, 0, 0],
                    },
                })),
                emphasis: {
                    focus: 'none',
                    disabled: true,
                },
                select: {
                    disabled: true,
                },
            },
        ],
        animation: true,
        animationDuration: 300,
    }
}

export default function LeaderboardPage() {
    const [accountData, setAccountData] = useState<
        UserPortalResponse['data'] | null
    >(null)
    const [leaderboardData, setLeaderboardData] = useState<
        LeaderboardResponse['data'] | null
    >(null)
    const [loadingAccount, setLoadingAccount] = useState(true)
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)
    const [recentRecordsLoadingMore, setRecentRecordsLoadingMore] =
        useState(false)
    const [profileReady, setProfileReady] = useState(false)
    const [timeRange, setTimeRange] = useState<TimeRange>('30d')
    const [metric, setMetric] = useState<LeaderboardMetric>('cost')
    const [showNameOnLeaderboard, setShowNameOnLeaderboard] = useState(false)
    const [leaderboardNickname, setLeaderboardNickname] = useState('')
    const [leaderboardColor, setLeaderboardColor] = useState<string>(
        DEFAULT_LEADERBOARD_BAR_COLOR
    )
    const [saving, setSaving] = useState(false)
    const router = useRouter()
    const { t } = useTranslation('common')
    const currencySymbol = t('common.currency')
    const hasFetchedInitialLeaderboard = useRef(false)
    const chartRef = useRef<ECharts>()

    const fetchLeaderboardData = useCallback(
        async (page = 1, append = false) => {
            if (append) {
                setRecentRecordsLoadingMore(true)
            } else {
                setLoadingLeaderboard(true)
            }

            try {
                const days = getDaysForRange(timeRange)
                const params = new URLSearchParams({
                    page: String(page),
                    pageSize: String(RECENT_RECORDS_PAGE_SIZE),
                })

                if (days > 0) {
                    params.set('days', String(days))
                }

                const response = await fetch(
                    `/api/v1/user-portal/leaderboard?${params.toString()}`
                )
                const payload: LeaderboardResponse = await response.json()

                if (response.status === 401) {
                    router.replace('/account/login')
                    return
                }

                if (!response.ok || !payload.data) {
                    throw new Error(
                        payload.error || t('userPortal.leaderboard.loadFailed')
                    )
                }

                const nextData = payload.data

                if (append) {
                    setLeaderboardData((currentData) => ({
                        ...nextData,
                        recentRecords: [
                            ...(currentData?.recentRecords || []),
                            ...nextData.recentRecords,
                        ],
                    }))
                } else {
                    setLeaderboardData(nextData)
                }

                hasFetchedInitialLeaderboard.current = true
            } finally {
                if (append) {
                    setRecentRecordsLoadingMore(false)
                } else {
                    setLoadingLeaderboard(false)
                }
            }
        },
        [router, t, timeRange]
    )

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
                        payload.error || t('userPortal.leaderboard.loadFailed')
                    )
                }

                setAccountData(payload.data)
                setShowNameOnLeaderboard(
                    payload.data.profile.showNameOnLeaderboard
                )
                setLeaderboardNickname(
                    payload.data.profile.leaderboardNickname ||
                        payload.data.profile.name
                )
                setLeaderboardColor(
                    payload.data.profile.leaderboardColor ||
                        DEFAULT_LEADERBOARD_BAR_COLOR
                )
                setProfileReady(true)
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : t('userPortal.leaderboard.loadFailed')
                )
            } finally {
                setLoadingAccount(false)
            }
        }

        loadAccount()
    }, [router, t])

    useEffect(() => {
        if (!profileReady) {
            return
        }

        fetchLeaderboardData().catch((error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('userPortal.leaderboard.loadFailed')
            )
        })
    }, [fetchLeaderboardData, profileReady, t])

    const sortedUsers = [...(leaderboardData?.users || [])].sort((a, b) => {
        const difference = getMetricValue(b, metric) - getMetricValue(a, metric)

        if (difference !== 0) {
            return difference
        }

        return (
            b.totalCost - a.totalCost ||
            a.displayName.localeCompare(b.displayName)
        )
    })
    const recentRecords = leaderboardData?.recentRecords || []
    const recentRecordsTotal =
        leaderboardData?.recentRecordsPagination.total || 0
    const hasMoreRecentRecords = recentRecords.length < recentRecordsTotal

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.resize()
                chartRef.current.setOption(
                    getLeaderboardChartOption(
                        sortedUsers,
                        metric,
                        currencySymbol
                    )
                )
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [currencySymbol, metric, sortedUsers])

    const handleSavePreferences = async () => {
        if (!accountData) {
            return
        }

        setSaving(true)

        try {
            const normalizedNickname = normalizeLeaderboardNickname(
                leaderboardNickname,
                accountData.profile.name
            )

            const response = await fetch('/api/v1/user-portal/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    showNameOnLeaderboard,
                    leaderboardNickname: normalizedNickname,
                    leaderboardColor,
                }),
            })

            const payload = await response.json()

            if (response.status === 401) {
                router.replace('/account/login')
                return
            }

            if (!response.ok) {
                throw new Error(
                    payload.error || t('userPortal.leaderboard.saveFailed')
                )
            }

            setAccountData({
                ...accountData,
                profile: {
                    ...accountData.profile,
                    showNameOnLeaderboard,
                    leaderboardNickname: normalizedNickname,
                    leaderboardColor,
                },
            })
            setLeaderboardNickname(
                normalizedNickname || accountData.profile.name
            )
            toast.success(t('userPortal.leaderboard.saveSuccess'))

            if (hasFetchedInitialLeaderboard.current) {
                await fetchLeaderboardData()
            }
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('userPortal.leaderboard.saveFailed')
            )
        } finally {
            setSaving(false)
        }
    }

    const loadMoreRecentRecords = () => {
        if (
            loadingLeaderboard ||
            recentRecordsLoadingMore ||
            !hasMoreRecentRecords
        ) {
            return
        }

        fetchLeaderboardData(
            (leaderboardData?.recentRecordsPagination.page || 1) + 1,
            true
        ).catch((error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('userPortal.leaderboard.loadFailed')
            )
        })
    }

    const handleRecentRecordsScroll = (event: UIEvent<HTMLDivElement>) => {
        const { clientHeight, scrollHeight, scrollTop } = event.currentTarget

        if (scrollHeight - scrollTop - clientHeight < 160) {
            loadMoreRecentRecords()
        }
    }

    if (
        loadingAccount ||
        (profileReady && loadingLeaderboard && !leaderboardData)
    ) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!accountData || !leaderboardData) {
        return (
            <div className="py-10 text-center text-sm text-muted-foreground">
                {t('userPortal.leaderboard.loadFailed')}
            </div>
        )
    }

    const savedNickname = accountData.profile.leaderboardNickname || null
    const savedColor =
        accountData.profile.leaderboardColor || DEFAULT_LEADERBOARD_BAR_COLOR
    const nextNickname = normalizeLeaderboardNickname(
        leaderboardNickname,
        accountData.profile.name
    )
    const hasPendingChanges =
        showNameOnLeaderboard !== accountData.profile.showNameOnLeaderboard ||
        nextNickname !== savedNickname ||
        leaderboardColor !== savedColor
    const joinedAt =
        accountData.overview.firstUseTime || accountData.profile.createdAt

    return (
        <div className="space-y-4">
            <div className="mb-4">
                <h1 className="text-lg font-medium">
                    {accountData.profile.name}
                </h1>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                        {accountData.profile.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        · {t('userPortal.account.overview.firstUse')}{' '}
                        {formatDateOnly(
                            joinedAt,
                            t('userPortal.account.never')
                        )}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex items-center gap-3">
                    <div className="space-y-1.5 shrink-0">
                        <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                                checked={showNameOnLeaderboard}
                                onCheckedChange={(checked) =>
                                    setShowNameOnLeaderboard(checked === true)
                                }
                            />
                            <span>
                                {t('userPortal.leaderboard.settings.showName')}
                            </span>
                        </label>

                        {showNameOnLeaderboard && (
                            <div className="ml-7 flex items-center gap-2">
                                {LEADERBOARD_BAR_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        aria-label={`${t('userPortal.leaderboard.settings.barColor')} ${color}`}
                                        onClick={() =>
                                            setLeaderboardColor(color)
                                        }
                                        className={cn(
                                            'h-4 w-4 border border-border transition-all',
                                            leaderboardColor === color &&
                                                'ring-2 ring-foreground ring-offset-1 ring-offset-background'
                                        )}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <Input
                        id="leaderboard-nickname"
                        maxLength={40}
                        value={leaderboardNickname}
                        onChange={(event) =>
                            setLeaderboardNickname(event.target.value)
                        }
                        placeholder={
                            showNameOnLeaderboard
                                ? accountData.profile.name
                                : t('userPortal.leaderboard.anonymous')
                        }
                        disabled={!showNameOnLeaderboard}
                        className={cn(
                            'w-[200px]',
                            !showNameOnLeaderboard && 'text-muted-foreground'
                        )}
                    />

                    {hasPendingChanges && (
                        <Button
                            onClick={handleSavePreferences}
                            disabled={saving}
                            className="gap-2"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {saving
                                ? t('userPortal.leaderboard.settings.saving')
                                : t('userPortal.leaderboard.settings.save')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span className="text-xs font-medium">
                                {t('userPortal.leaderboard.overview.title')}
                            </span>
                        </div>
                        <div className="w-px h-4 bg-border" />
                        <div className="flex gap-1">
                            <Button
                                variant={
                                    metric === 'cost' ? 'default' : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setMetric('cost')}
                            >
                                {t('userPortal.leaderboard.chart.metrics.usd')}
                            </Button>
                            <Button
                                variant={
                                    metric === 'tokens' ? 'default' : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setMetric('tokens')}
                            >
                                {t(
                                    'userPortal.leaderboard.chart.metrics.tokens'
                                )}
                            </Button>
                            <Button
                                variant={
                                    metric === 'calls' ? 'default' : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setMetric('calls')}
                            >
                                {t(
                                    'userPortal.leaderboard.chart.metrics.calls'
                                )}
                            </Button>
                            <Button
                                variant={
                                    metric === 'water' ? 'default' : 'outline'
                                }
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={() => setMetric('water')}
                            >
                                Water
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
                            onClick={() => setTimeRange('24h')}
                        >
                            24h
                        </Button>
                        <Button
                            variant={timeRange === '7d' ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setTimeRange('7d')}
                        >
                            7d
                        </Button>
                        <Button
                            variant={
                                timeRange === '30d' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setTimeRange('30d')}
                        >
                            30d
                        </Button>
                        <Button
                            variant={
                                timeRange === '90d' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setTimeRange('90d')}
                        >
                            90d
                        </Button>
                        <Button
                            variant={
                                timeRange === 'all' ? 'default' : 'outline'
                            }
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setTimeRange('all')}
                        >
                            All
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 md:gap-0 md:divide-x">
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('userPortal.leaderboard.overview.calls')}
                        </p>
                        <p className="text-lg font-medium">
                            {loadingLeaderboard
                                ? '-'
                                : formatNumber(
                                      leaderboardData?.totalCalls || 0
                                  )}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('userPortal.leaderboard.overview.tokens')}
                        </p>
                        <p className="text-lg font-medium">
                            {loadingLeaderboard
                                ? '-'
                                : formatNumber(
                                      leaderboardData?.totalTokens || 0
                                  )}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('userPortal.leaderboard.overview.spend')}
                        </p>
                        <p className="text-lg font-medium">
                            {loadingLeaderboard
                                ? '-'
                                : formatCurrency(
                                      leaderboardData?.totalCost || 0,
                                      currencySymbol
                                  )}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            {t('userPortal.leaderboard.overview.averageCost')}
                        </p>
                        <p className="text-lg font-medium">
                            {loadingLeaderboard
                                ? '-'
                                : formatCurrency(
                                      leaderboardData?.averageCost || 0,
                                      currencySymbol
                                  )}
                        </p>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                            Water use
                        </p>
                        <p className="text-lg font-medium">
                            {loadingLeaderboard
                                ? '-'
                                : `${((leaderboardData?.totalCost || 0) / 23.04).toFixed(4)} Gal`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden">
                <div className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex flex-1 items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <h2 className="text-sm font-medium">
                                {t('userPortal.leaderboard.chart.title')}
                            </h2>
                        </div>
                    </div>

                    {loadingLeaderboard ? (
                        <div className="flex h-[200px] items-center justify-center sm:h-[250px]">
                            <Skeleton className="h-full w-full" />
                        </div>
                    ) : sortedUsers.length === 0 ? (
                        <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground sm:h-[250px]">
                            {t('userPortal.leaderboard.chart.empty')}
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-end">
                                <span className="text-xs text-muted-foreground">
                                    {t('userPortal.leaderboard.chart.users', {
                                        count: sortedUsers.length,
                                    })}
                                </span>
                            </div>

                            <div className="h-[200px] sm:h-[250px]">
                                <ReactECharts
                                    option={getLeaderboardChartOption(
                                        sortedUsers,
                                        metric,
                                        currencySymbol
                                    )}
                                    style={{ height: '100%', width: '100%' }}
                                    onChartReady={(instance) =>
                                        (chartRef.current = instance)
                                    }
                                    className="bar-chart"
                                />
                            </div>
                        </>
                    )}
                </div>
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

                        {loadingLeaderboard && recentRecords.length === 0 ? (
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
                                            <th className="px-3 py-2 font-normal">
                                                User
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
                                                <td className="px-3 py-2">
                                                    <span
                                                        className="block max-w-[120px] truncate"
                                                        title={record.displayName}
                                                    >
                                                        {record.displayName}
                                                    </span>
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

                        {leaderboardData.topModels.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div className="max-h-96 divide-y overflow-y-auto">
                                {leaderboardData.topModels.map(
                                    (model, index) => (
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
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Most Expensive Call Section */}
            {leaderboardData?.mostExpensiveCall && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <h2 className="text-sm font-medium">
                            {t('userPortal.leaderboard.mostExpensive.title')}
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 md:gap-0 md:divide-x">
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                {t('userPortal.leaderboard.mostExpensive.user')}
                            </p>
                            <p className="text-lg font-medium">
                                {leaderboardData.mostExpensiveCall.isAnonymous
                                    ? t('userPortal.leaderboard.anonymous')
                                    : leaderboardData.mostExpensiveCall
                                          .displayName}
                            </p>
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                {t(
                                    'userPortal.leaderboard.mostExpensive.model'
                                )}
                            </p>
                            <p
                                className="text-lg font-medium truncate"
                                title={
                                    leaderboardData.mostExpensiveCall.modelName
                                }
                            >
                                {leaderboardData.mostExpensiveCall.modelName
                                    .length > 20
                                    ? `${leaderboardData.mostExpensiveCall.modelName.slice(0, 20)}...`
                                    : leaderboardData.mostExpensiveCall
                                          .modelName}
                            </p>
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                {t(
                                    'userPortal.leaderboard.mostExpensive.tokens'
                                )}
                            </p>
                            <p className="text-lg font-medium">
                                {formatNumber(
                                    leaderboardData.mostExpensiveCall
                                        .totalTokens
                                )}
                            </p>
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                {t('userPortal.leaderboard.mostExpensive.cost')}
                            </p>
                            <p className="text-lg font-medium text-yellow-500">
                                {formatCurrency(
                                    leaderboardData.mostExpensiveCall.cost,
                                    currencySymbol
                                )}
                            </p>
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground mb-1">
                                {t('userPortal.leaderboard.mostExpensive.time')}
                            </p>
                            <p className="text-sm font-medium">
                                {formatDateOnly(
                                    leaderboardData.mostExpensiveCall.useTime,
                                    '-'
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
