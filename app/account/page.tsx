'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
    BarChart3,
    Check,
    Clock3,
    Copy,
    CreditCard,
    ExternalLink,
    LogOut,
    Loader2,
    Sparkles,
    Wallet,
    Zap,
    Users,
    Database,
    PieChart,
    FileText,
    Shield,
    Globe,
    Settings,
    Github,
    ChevronDown,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'

import { Button } from '@/components/ui/button'
import { copyTextToClipboard } from '@/lib/clipboard'
import { APP_VERSION } from '@/lib/version'
import DatabaseBackup from '@/components/DatabaseBackup'

// Lazy-load admin panel components for code splitting
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
const RecordsPanel = dynamic(() => import('@/components/admin/RecordsPanel'), {
    loading: () => <AdminTabLoader />,
    ssr: false,
})

function AdminTabLoader() {
    return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
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
        recentWindow: {
            totalCost: number
            totalCalls: number
            totalTokens: number
        }
        topModels: Array<{
            modelName: string
            totalCost: number
            totalCalls: number
            totalTokens: number
        }>
        recentRecords: Array<{
            id: number
            useTime: string
            modelName: string
            inputTokens: number
            outputTokens: number
            totalTokens: number
            cost: number
            balanceAfter: number
        }>
    }
}

type TabId = 'dashboard' | 'users' | 'models' | 'panel'

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
            } catch (error) {
                toast.error(
                    error instanceof Error
                        ? error.message
                        : t('userPortal.account.loadFailed')
                )
            } finally {
                setLoading(false)
            }
        }

        loadAccount()
    }, [router, t])

    // Auto-check for updates on load
    useEffect(() => {
        const autoCheckUpdate = async () => {
            try {
                const response = await fetch(
                    'https://api.github.com/repos/variantconst/openwebui-monitor/releases/latest'
                )
                const data = await response.json()
                const latestVer = data.tag_name
                if (!latestVer) return

                const currentVer = APP_VERSION.replace(/^v/, '')
                const newVer = latestVer.replace(/^v/, '')

                const ignoredVersion =
                    localStorage.getItem('ignoredVersion')
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
                                label: t('header.update.skipUpdate', {
                                    defaultValue: 'Ignore',
                                }),
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
            } catch (error) {
                // silently fail — update check is non-critical
            }
        }

        autoCheckUpdate()
    }, [t])

    // Fetch API key for admins
    useEffect(() => {
        if (!isAdmin) return

        const fetchApiKey = async () => {
            try {
                const res = await fetch('/api/v1/config')
                const data = await res.json()
                if (data?.apiKey) {
                    setApiKey(data.apiKey)
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
        } catch (error) {
            console.error('Failed to copy login URL:', error)
            toast.error(t('userPortal.account.copyUrl.error'))
        }
    }

    const handleCopyApiKey = async () => {
        if (!apiKey) return

        try {
            await copyTextToClipboard(apiKey)
            toast.success(t('header.messages.apiKeyCopied'))
        } catch (error) {
            console.error('Failed to copy API key:', error)
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
            const data = await response.json()
            const latestVersion = data.tag_name

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
        } catch (error) {
            toast.error(t('header.messages.updateCheckFailed'))
            console.error(t('header.messages.updateCheckFailed'), error)
        } finally {
            setIsCheckingUpdate(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
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
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Top Header Bar */}
            <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-14 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                <Shield className="h-4 w-4 text-emerald-400" />
                            </div>
                            <span className="text-sm font-semibold text-white">
                                {t('common.appName')}
                            </span>
                            {isAdmin && (
                                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                    Admin
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {/* Language Switcher */}
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
                                <button className="flex h-8 items-center gap-1 rounded-md px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span className="hidden text-xs font-medium sm:inline">
                                        {langLabel}
                                    </span>
                                    <ChevronDown className="h-3 w-3" />
                                </button>
                            </Dropdown>

                            {/* Settings (admin only) */}
                            {isAdmin && (
                                <button
                                    className="flex h-8 items-center gap-1 rounded-md px-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                    onClick={() =>
                                        setIsSettingsOpen(!isSettingsOpen)
                                    }
                                >
                                    <Settings className="h-3.5 w-3.5" />
                                </button>
                            )}

                            {/* Copy Login URL */}
                            {data.profile.viewerToken && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                    onClick={handleCopyLoginUrl}
                                >
                                    {copied ? (
                                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                        <Copy className="mr-1.5 h-3.5 w-3.5" />
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

                            {/* Logout */}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                onClick={handleLogout}
                                disabled={loggingOut}
                            >
                                {loggingOut ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                <span className="hidden sm:inline">
                                    {t('userPortal.account.logout')}
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-hide">
                        {visibleTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-emerald-400 text-emerald-400'
                                        : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Settings Panel (admin only) */}
            {isAdmin && isSettingsOpen && (
                <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
                    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-slate-300">
                                {t('header.menu.settings', {
                                    defaultValue: 'Settings',
                                })}
                            </h3>
                            <button
                                className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                                onClick={() => setIsSettingsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button
                                onClick={handleCopyApiKey}
                                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                            >
                                <Copy className="h-4 w-4 text-sky-400" />
                                {t('header.menu.copyApiKey')}
                            </button>
                            <button
                                onClick={() => {
                                    setIsBackupModalOpen(true)
                                    setIsSettingsOpen(false)
                                }}
                                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                            >
                                <Database className="h-4 w-4 text-rose-400" />
                                {t('header.menu.dataBackup')}
                            </button>
                            <button
                                onClick={checkUpdate}
                                disabled={isCheckingUpdate}
                                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
                            >
                                {isCheckingUpdate ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                                ) : (
                                    <Github className="h-4 w-4 text-emerald-400" />
                                )}
                                {t('header.menu.checkUpdate')}
                            </button>
                            <a
                                href="https://github.com/VariantConst/OpenWebUI-Monitor"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                            >
                                <ExternalLink className="h-4 w-4 text-violet-400" />
                                GitHub
                            </a>
                        </div>
                        <div className="mt-2 text-right text-xs text-slate-600">
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

            {/* Tab Content */}
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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

// ─── Dashboard Tab (existing user portal content) ──────────────────────────

function DashboardTab({
    data,
    currencySymbol,
    t,
}: {
    data: NonNullable<UserPortalResponse['data']>
    currencySymbol: string
    t: (key: string, options?: Record<string, unknown>) => string
}) {
    return (
        <div>
            {/* User Info */}
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white">
                    {data.profile.name}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                    {data.profile.email}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                        <Wallet className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                            {t('userPortal.account.cards.balance')}
                        </p>
                        <p className="truncate text-lg font-semibold text-emerald-400">
                            {formatCurrency(
                                data.profile.balance,
                                currencySymbol
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10">
                        <BarChart3 className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                            {t('userPortal.account.cards.totalCalls')}
                        </p>
                        <p className="truncate text-lg font-semibold text-white">
                            {formatNumber(data.overview.totalCalls)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                            {t('userPortal.account.cards.totalTokens')}
                        </p>
                        <p className="truncate text-lg font-semibold text-white">
                            {formatNumber(data.overview.totalTokens)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                        <Clock3 className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-400">
                            {t('userPortal.account.cards.lastActive')}
                        </p>
                        <p className="truncate text-sm font-medium text-white">
                            {data.overview.lastUseTime
                                ? formatShortDate(
                                      data.overview.lastUseTime,
                                      t('userPortal.account.never')
                                  )
                                : t('userPortal.account.never')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Recent Activity */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-sky-400" />
                                <h2 className="text-sm font-medium text-white">
                                    {t(
                                        'userPortal.account.recentActivity.title'
                                    )}
                                </h2>
                            </div>
                        </div>
                        <div className="grid divide-y divide-slate-800 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.recentActivity.calls'
                                    )}
                                </p>
                                <p className="mt-1 text-xl font-semibold text-white">
                                    {formatNumber(
                                        data.recentWindow.totalCalls
                                    )}
                                </p>
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.recentActivity.tokens'
                                    )}
                                </p>
                                <p className="mt-1 text-xl font-semibold text-white">
                                    {formatNumber(
                                        data.recentWindow.totalTokens
                                    )}
                                </p>
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.recentActivity.cost'
                                    )}
                                </p>
                                <p className="mt-1 text-xl font-semibold text-white">
                                    {formatCurrency(
                                        data.recentWindow.totalCost,
                                        currencySymbol
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Lifetime Overview */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-violet-400" />
                                <h2 className="text-sm font-medium text-white">
                                    {t('userPortal.account.overview.title')}
                                </h2>
                            </div>
                        </div>
                        <div className="grid divide-y divide-slate-800 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.overview.totalSpend'
                                    )}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                    {formatCurrency(
                                        data.overview.totalCost,
                                        currencySymbol
                                    )}
                                </p>
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.overview.averageCost'
                                    )}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                    {formatCurrency(
                                        data.overview.averageCost,
                                        currencySymbol
                                    )}
                                </p>
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'userPortal.account.overview.firstUse'
                                    )}
                                </p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                    {formatShortDate(
                                        data.overview.firstUseTime,
                                        t('userPortal.account.never')
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Recent Records Table */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-slate-400" />
                                <h2 className="text-sm font-medium text-white">
                                    {t('userPortal.account.records.title')}
                                </h2>
                            </div>
                            <span className="text-xs text-slate-500">
                                {data.recentRecords.length}{' '}
                                {data.recentRecords.length === 1
                                    ? 'record'
                                    : 'records'}
                            </span>
                        </div>

                        {data.recentRecords.length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                                            <th className="px-4 py-2 font-medium">
                                                {t(
                                                    'userPortal.account.records.time'
                                                )}
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                                {t(
                                                    'userPortal.account.records.model'
                                                )}
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                                {t(
                                                    'userPortal.account.records.tokens'
                                                )}
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                                {t(
                                                    'userPortal.account.records.cost'
                                                )}
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                                {t(
                                                    'userPortal.account.records.balanceAfter'
                                                )}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {data.recentRecords.map((record) => (
                                            <tr
                                                key={record.id}
                                                className="text-slate-300"
                                            >
                                                <td className="px-4 py-2.5 text-xs">
                                                    {formatDate(
                                                        record.useTime,
                                                        '-'
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-white">
                                                    <span
                                                        className="block max-w-[200px] truncate"
                                                        title={
                                                            record.modelName
                                                        }
                                                    >
                                                        {record.modelName}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {formatNumber(
                                                        record.totalTokens
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {formatCurrency(
                                                        record.cost,
                                                        currencySymbol
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-medium text-emerald-400">
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

                {/* Right Column - Top Models */}
                <div className="space-y-6">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/30">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-slate-400" />
                                <h2 className="text-sm font-medium text-white">
                                    {t('userPortal.account.topModels.title')}
                                </h2>
                            </div>
                        </div>

                        {data.topModels.length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">
                                {t('userPortal.account.empty')}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {data.topModels.map((model, index) => (
                                    <div
                                        key={model.modelName}
                                        className="flex items-center justify-between gap-3 px-4 py-3"
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-xs font-medium text-slate-400">
                                                {index + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className="truncate text-sm font-medium text-white"
                                                    title={model.modelName}
                                                >
                                                    {model.modelName}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {formatNumber(
                                                        model.totalCalls
                                                    )}{' '}
                                                    {t(
                                                        'userPortal.account.topModels.calls'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-sm font-medium text-emerald-400">
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
