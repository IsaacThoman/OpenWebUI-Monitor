'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
    BarChart3,
    Check,
    Copy,
    ExternalLink,
    LogOut,
    Loader2,
    Zap,
    Users,
    Database,
    PieChart,
    Globe,
    Settings,
    Github,
    X,
    ChevronDown,
    Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'

import { Button } from '@/components/ui/button'
import { copyTextToClipboard } from '@/lib/clipboard'
import { APP_VERSION } from '@/lib/version'
import DatabaseBackup from '@/components/DatabaseBackup'

const UsersPanel = dynamic(() => import('@/components/admin/UsersPanel'), {
    loading: () => <AdminTabLoader />,
    ssr: false,
})
const ModelsPanel = dynamic(() => import('@/components/admin/ModelsPanel'), {
    loading: () => <AdminTabLoader />,
    ssr: false,
})
const AnalyticsPanel = dynamic(
    () => import('@/components/admin/AnalyticsPanel'),
    {
        loading: () => <AdminTabLoader />,
        ssr: false,
    }
)

function AdminTabLoader() {
    return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
    )
}

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

type TabId = 'dashboard' | 'users' | 'models' | 'panel'
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

function formatShortDate(value: string | null, fallback: string): string {
    if (!value) {
        return fallback
    }
    const date = new Date(value)
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

const timeRangeLabels: Record<TimeRange, string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    all: 'All time',
}

export default function AccountPage() {
    const [data, setData] = useState<UserPortalResponse['data'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState<TabId>('dashboard')
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const router = useRouter()
    const { t, i18n } = useTranslation('common')
    const currencySymbol = t('common.currency')

    const isAdmin = data?.profile.role === 'admin'

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

    useEffect(() => {
        const autoCheckUpdate = async () => {
            try {
                const response = await fetch(
                    'https://api.github.com/repos/variantconst/openwebui-monitor/releases/latest'
                )
                const releaseData = await response.json()
                const latestVer = releaseData.tag_name
                if (!latestVer) return

                const currentVer = APP_VERSION.replace(/^v/, '')
                const newVer = latestVer.replace(/^v/, '')

                const ignoredVersion = localStorage.getItem('ignoredVersion')
                if (currentVer !== newVer && ignoredVersion !== latestVer) {
                    toast.info(
                        `${t('header.update.newVersion')}: ${latestVer}`,
                        {
                            duration: 10000,
                            action: {
                                label: t('header.update.goToUpdate'),
                                onClick: () =>
                                    window.open(
                                        'https://github.com/VariantConst/OpenWebUI-Monitor/releases/latest',
                                        '_blank'
                                    ),
                            },
                            cancel: {
                                label: t('header.update.skipUpdate'),
                                onClick: () => {
                                    localStorage.setItem(
                                        'ignoredVersion',
                                        latestVer
                                    )
                                },
                            },
                        }
                    )
                }
            } catch {
                // silently fail
            }
        }

        autoCheckUpdate()
    }, [t])

    useEffect(() => {
        if (!isAdmin) return
        const fetchApiKey = async () => {
            try {
                const res = await fetch('/api/v1/config')
                const configData = await res.json()
                if (configData?.apiKey) {
                    setApiKey(configData.apiKey)
                }
            } catch {
                // silently fail
            }
        }
        fetchApiKey()
    }, [isAdmin])

    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await fetch('/api/v1/user-portal/session', {
                method: 'DELETE',
            })
            router.push('/account/login')
            router.refresh()
        } finally {
            setLoggingOut(false)
        }
    }

    const handleCopyLoginUrl = async () => {
        if (!data?.profile.viewerToken) return
        try {
            const loginUrl = `${window.location.origin}/u/${data.profile.viewerToken}`
            await copyTextToClipboard(loginUrl)
            setCopied(true)
            toast.success(t('userPortal.account.copyUrl.success'))
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error(t('userPortal.account.copyUrl.error'))
        }
    }

    const handleCopyApiKey = async () => {
        if (!apiKey) return
        try {
            await copyTextToClipboard(apiKey)
            toast.success(t('header.messages.apiKeyCopied'))
        } catch {
            toast.error(t('header.messages.copyFailed'))
        }
    }

    const handleLanguageChange = async (newLang: string) => {
        await i18n.changeLanguage(newLang)
        localStorage.setItem('language', newLang)
    }

    const checkUpdate = async () => {
        setIsCheckingUpdate(true)
        try {
            const response = await fetch(
                'https://api.github.com/repos/variantconst/openwebui-monitor/releases/latest'
            )
            const releaseData = await response.json()
            const latestVersion = releaseData.tag_name

            if (!latestVersion) {
                throw new Error(t('header.messages.getVersionFailed'))
            }

            const currentVer = APP_VERSION.replace(/^v/, '')
            const newVer = latestVersion.replace(/^v/, '')

            if (currentVer === newVer) {
                toast.success(t('header.messages.alreadyLatest'))
            } else {
                toast.info(
                    `${t('header.update.newVersion')}: ${latestVersion}`,
                    {
                        action: {
                            label: t('header.update.goToUpdate'),
                            onClick: () =>
                                window.open(
                                    'https://github.com/VariantConst/OpenWebUI-Monitor/releases/latest',
                                    '_blank'
                                ),
                        },
                    }
                )
            }
        } catch {
            toast.error(t('header.messages.updateCheckFailed'))
        } finally {
            setIsCheckingUpdate(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('userPortal.account.loading')}
                </div>
            </div>
        )
    }

    if (!data) {
        return null
    }

    const tabs: {
        id: TabId
        label: string
        icon: React.ReactNode
        adminOnly?: boolean
    }[] = [
        {
            id: 'dashboard',
            label: t('userPortal.account.tabs.dashboard', {
                defaultValue: 'Dashboard',
            }),
            icon: <BarChart3 className="h-4 w-4" />,
        },
        {
            id: 'users',
            label: t('home.features.users.title', { defaultValue: 'Users' }),
            icon: <Users className="h-4 w-4" />,
            adminOnly: true,
        },
        {
            id: 'models',
            label: t('home.features.models.title', { defaultValue: 'Models' }),
            icon: <Database className="h-4 w-4" />,
            adminOnly: true,
        },
        {
            id: 'panel',
            label: t('home.features.stats.title', {
                defaultValue: 'Analytics',
            }),
            icon: <PieChart className="h-4 w-4" />,
            adminOnly: true,
        },
    ]

    const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin)

    const langLabel =
        i18n.language === 'zh'
            ? t('header.language.zh')
            : i18n.language === 'es'
              ? t('header.language.es')
              : t('header.language.en')

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b bg-background sticky top-0 z-50">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="flex h-12 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                                {t('common.appName')}
                            </span>
                            {isAdmin && (
                                <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground">
                                    Admin
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <Dropdown
                                menu={{
                                    items: [
                                        {
                                            key: 'en',
                                            label: 'English',
                                            onClick: () =>
                                                handleLanguageChange('en'),
                                        },
                                        {
                                            key: 'zh',
                                            label: '简体中文',
                                            onClick: () =>
                                                handleLanguageChange('zh'),
                                        },
                                        {
                                            key: 'es',
                                            label: 'Español',
                                            onClick: () =>
                                                handleLanguageChange('es'),
                                        },
                                    ],
                                    selectedKeys: [i18n.language],
                                }}
                                trigger={['click']}
                            >
                                <button className="flex h-7 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                    <Globe className="h-3 w-3" />
                                    <span className="hidden sm:inline">
                                        {langLabel}
                                    </span>
                                </button>
                            </Dropdown>

                            {isAdmin && (
                                <button
                                    className="flex h-7 items-center px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    onClick={() =>
                                        setIsSettingsOpen(!isSettingsOpen)
                                    }
                                >
                                    <Settings className="h-3 w-3" />
                                </button>
                            )}

                            {data.profile.viewerToken && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={handleCopyLoginUrl}
                                >
                                    {copied ? (
                                        <Check className="mr-1 h-3 w-3" />
                                    ) : (
                                        <Copy className="mr-1 h-3 w-3" />
                                    )}
                                    <span className="hidden sm:inline">
                                        {copied
                                            ? t(
                                                  'userPortal.account.copyUrl.copied'
                                              )
                                            : t(
                                                  'userPortal.account.copyUrl.label'
                                              )}
                                    </span>
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleLogout}
                                disabled={loggingOut}
                            >
                                {loggingOut ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                    <LogOut className="mr-1 h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">
                                    {t('userPortal.account.logout')}
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {visibleTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 whitespace-nowrap border-b px-3 py-2 text-xs transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-foreground text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            {isAdmin && isSettingsOpen && (
                <div className="border-b bg-muted/50">
                    <div className="mx-auto max-w-6xl px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-medium text-muted-foreground">
                                {t('header.menu.settings', {
                                    defaultValue: 'Settings',
                                })}
                            </h3>
                            <button
                                className="p-1 text-muted-foreground hover:text-foreground"
                                onClick={() => setIsSettingsOpen(false)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button
                                onClick={handleCopyApiKey}
                                className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <Copy className="h-3 w-3" />
                                {t('header.menu.copyApiKey')}
                            </button>
                            <button
                                onClick={() => {
                                    setIsBackupModalOpen(true)
                                    setIsSettingsOpen(false)
                                }}
                                className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <Database className="h-3 w-3" />
                                {t('header.menu.dataBackup')}
                            </button>
                            <button
                                onClick={checkUpdate}
                                disabled={isCheckingUpdate}
                                className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                {isCheckingUpdate ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Github className="h-3 w-3" />
                                )}
                                {t('header.menu.checkUpdate')}
                            </button>
                            <a
                                href="https://github.com/VariantConst/OpenWebUI-Monitor"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                            >
                                <ExternalLink className="h-3 w-3" />
                                GitHub
                            </a>
                        </div>
                        <div className="mt-2 text-right text-xs text-muted-foreground">
                            v{APP_VERSION}
                        </div>
                    </div>
                </div>
            )}

            {/* Database Backup Modal */}
            {isAdmin && (
                <DatabaseBackup
                    isOpen={isBackupModalOpen}
                    onClose={() => setIsBackupModalOpen(false)}
                />
            )}

            {/* Content */}
            <div className="mx-auto max-w-6xl px-4 py-4">
                {activeTab === 'dashboard' && (
                    <DashboardTab
                        data={data}
                        currencySymbol={currencySymbol}
                        t={t}
                    />
                )}
                {activeTab === 'users' && isAdmin && (
                    <div className="admin-dark-theme">
                        <UsersPanel />
                    </div>
                )}
                {activeTab === 'models' && isAdmin && (
                    <div className="admin-dark-theme">
                        <ModelsPanel />
                    </div>
                )}
                {activeTab === 'panel' && isAdmin && (
                    <div className="admin-dark-theme">
                        <AnalyticsPanel />
                    </div>
                )}
            </div>
        </div>
    )
}

// Dashboard Tab
function DashboardTab({
    data,
    currencySymbol,
    t,
}: {
    data: NonNullable<UserPortalResponse['data']>
    currencySymbol: string
    t: (key: string, options?: Record<string, unknown>) => string
}) {
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

    return (
        <div>
            {/* User Info */}
            <div className="mb-4">
                <h1 className="text-lg font-medium">{data.profile.name}</h1>
                <p className="text-xs text-muted-foreground">
                    {data.profile.email}
                </p>
            </div>

            {/* Balance - Left aligned, not a card */}
            <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-1">
                    Current balance
                </p>
                <p className="text-2xl font-medium">
                    {formatCurrency(data.profile.balance, currencySymbol)}
                </p>
            </div>

            {/* Time Range Selector + Stats */}
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

                {/* Stats Grid */}
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

            {/* Main Grid */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Left - Recent Usage */}
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

                {/* Right - Top Models */}
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
