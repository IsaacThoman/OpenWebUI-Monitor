'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ECharts } from 'echarts'
import ReactECharts from 'echarts-for-react'
import {
    BarChartOutlined,
    DollarOutlined,
    LineChartOutlined,
} from '@ant-design/icons'
import { BarChart3, ChevronDown, Clock, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
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
            totalCalls: number
            totalTokens: number
            totalCost: number
            averageCost: number
        }>
    }
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all'
type LeaderboardMetric = 'cost' | 'tokens' | 'calls'

function formatCurrency(value: number, currencySymbol: string): string {
    return `${currencySymbol}${value.toFixed(4)}`
}

function formatNumber(value: number): string {
    return value.toLocaleString()
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
              <span class="text-xs" style="color: hsl(220 15% 55%)">${metric === 'cost' ? 'USD' : metric === 'tokens' ? 'Tokens' : 'Calls'}</span>
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
                            : 'hsl(220 70% 55%)',
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
    const [profileReady, setProfileReady] = useState(false)
    const [timeRange, setTimeRange] = useState<TimeRange>('30d')
    const [metric, setMetric] = useState<LeaderboardMetric>('cost')
    const [showNameOnLeaderboard, setShowNameOnLeaderboard] = useState(false)
    const [leaderboardNickname, setLeaderboardNickname] = useState('')
    const [saving, setSaving] = useState(false)
    const router = useRouter()
    const { t } = useTranslation('common')
    const currencySymbol = t('common.currency')
    const hasFetchedInitialLeaderboard = useRef(false)
    const chartRef = useRef<ECharts>()

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

        const loadLeaderboard = async () => {
            setLoadingLeaderboard(true)

            try {
                const days = getDaysForRange(timeRange)
                const params = new URLSearchParams()

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

                setLeaderboardData(payload.data)
                hasFetchedInitialLeaderboard.current = true
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : t('userPortal.leaderboard.loadFailed')
                )
            } finally {
                setLoadingLeaderboard(false)
            }
        }

        loadLeaderboard()
    }, [profileReady, router, t, timeRange])

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
                },
            })
            setLeaderboardNickname(
                normalizedNickname || accountData.profile.name
            )
            toast.success(t('userPortal.leaderboard.saveSuccess'))

            if (hasFetchedInitialLeaderboard.current) {
                const days = getDaysForRange(timeRange)
                const params = new URLSearchParams()

                if (days > 0) {
                    params.set('days', String(days))
                }

                const leaderboardResponse = await fetch(
                    `/api/v1/user-portal/leaderboard?${params.toString()}`
                )
                const leaderboardPayload: LeaderboardResponse =
                    await leaderboardResponse.json()

                if (leaderboardResponse.ok && leaderboardPayload.data) {
                    setLeaderboardData(leaderboardPayload.data)
                }
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
    const nextNickname = normalizeLeaderboardNickname(
        leaderboardNickname,
        accountData.profile.name
    )
    const hasPendingChanges =
        showNameOnLeaderboard !== accountData.profile.showNameOnLeaderboard ||
        nextNickname !== savedNickname
    const currentDisplayName = showNameOnLeaderboard
        ? leaderboardNickname.trim() || accountData.profile.name
        : t('userPortal.leaderboard.anonymous')
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-xs shrink-0">
                    <Checkbox
                        checked={showNameOnLeaderboard}
                        onCheckedChange={(checked) =>
                            setShowNameOnLeaderboard(checked === true)
                        }
                    />
                    <span>{t('userPortal.leaderboard.settings.showName')}</span>
                </label>

                <div className="flex flex-1 items-center gap-3">
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

            <div className="border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-medium">
                            {t('userPortal.leaderboard.overview.title')}
                        </span>
                    </div>
                    <div className="relative">
                        <select
                            value={timeRange}
                            onChange={(event) =>
                                setTimeRange(event.target.value as TimeRange)
                            }
                            className="appearance-none border bg-background px-2 py-1 pr-6 text-xs focus:outline-none"
                        >
                            <option value="24h">
                                {t('userPortal.leaderboard.periods.24h')}
                            </option>
                            <option value="7d">
                                {t('userPortal.leaderboard.periods.7d')}
                            </option>
                            <option value="30d">
                                {t('userPortal.leaderboard.periods.30d')}
                            </option>
                            <option value="90d">
                                {t('userPortal.leaderboard.periods.90d')}
                            </option>
                            <option value="all">
                                {t('userPortal.leaderboard.periods.all')}
                            </option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    </div>
                </div>

                <div className="grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    <div className="p-3">
                        <p className="mb-1 text-xs text-muted-foreground">
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
                        <p className="mb-1 text-xs text-muted-foreground">
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
                        <p className="mb-1 text-xs text-muted-foreground">
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
                        <p className="mb-1 text-xs text-muted-foreground">
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
                </div>
            </div>

            <div className="border overflow-hidden">
                <div className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex flex-1 items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            <h2 className="text-sm font-medium">
                                {t('userPortal.leaderboard.chart.title')}
                            </h2>
                        </div>

                        <div className="sm:ml-auto">
                            <div
                                className={cn(
                                    'flex w-full gap-1 border bg-muted p-1 sm:w-[320px]',
                                    'border-border'
                                )}
                            >
                                <button
                                    onClick={() => setMetric('cost')}
                                    className={cn(
                                        'relative inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                                        metric === 'cost'
                                            ? 'border border-border bg-background text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <DollarOutlined className="text-[12px]" />
                                    {t(
                                        'userPortal.leaderboard.chart.metrics.usd'
                                    )}
                                </button>

                                <button
                                    onClick={() => setMetric('tokens')}
                                    className={cn(
                                        'relative inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                                        metric === 'tokens'
                                            ? 'border border-border bg-background text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <BarChartOutlined className="text-[12px]" />
                                    {t(
                                        'userPortal.leaderboard.chart.metrics.tokens'
                                    )}
                                </button>

                                <button
                                    onClick={() => setMetric('calls')}
                                    className={cn(
                                        'relative inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                                        metric === 'calls'
                                            ? 'border border-border bg-background text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <LineChartOutlined className="text-[12px]" />
                                    {t(
                                        'userPortal.leaderboard.chart.metrics.calls'
                                    )}
                                </button>
                            </div>
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
        </div>
    )
}
