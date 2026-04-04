'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
    BarChart3,
    Check,
    Copy,
    ExternalLink,
    LogOut,
    Loader2,
    Users,
    Database,
    PieChart,
    Globe,
    Settings,
    Github,
    X,
    User,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Dropdown } from 'antd'

import { Button } from '@/components/ui/button'
import { copyTextToClipboard } from '@/lib/clipboard'
import { APP_VERSION } from '@/lib/version'
import DatabaseBackup from '@/components/DatabaseBackup'

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

type TabId = 'personal' | 'leaderboard' | 'users' | 'models' | 'analytics'

interface AccountLayoutProps {
    children: React.ReactNode
}

export default function AccountLayout({ children }: AccountLayoutProps) {
    const [data, setData] = useState<UserPortalResponse['data'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const router = useRouter()
    const pathname = usePathname()
    const { t, i18n } = useTranslation('common')
    const isLoginRoute = pathname === '/account/login'

    const isAdmin = data?.profile.role === 'admin'

    const redirectToLogin = useCallback(async () => {
        try {
            await fetch('/api/v1/user-portal/session', {
                method: 'DELETE',
            })
        } catch {
            // Best-effort cleanup for stale sessions.
        }

        router.replace('/account/login')
    }, [router])

    useEffect(() => {
        if (isLoginRoute) {
            setLoading(false)
            return
        }

        const loadAccount = async () => {
            try {
                const response = await fetch('/api/v1/user-portal/me')
                const payload: UserPortalResponse = await response.json()

                if (response.status === 401) {
                    await redirectToLogin()
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
    }, [isLoginRoute, redirectToLogin, t])

    useEffect(() => {
        if (isLoginRoute) return

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
    }, [isLoginRoute, t])

    useEffect(() => {
        if (isLoginRoute) return
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
    }, [isAdmin, isLoginRoute])

    useEffect(() => {
        if (isLoginRoute) return
        if (loading || !data) return

        const isAdminRoute =
            pathname.startsWith('/account/users') ||
            pathname.startsWith('/account/models') ||
            pathname.startsWith('/account/analytics')

        if (isAdminRoute && data.profile.role !== 'admin') {
            router.replace('/account/personal')
        }
    }, [data, isLoginRoute, loading, pathname, router])

    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await fetch('/api/v1/user-portal/session', {
                method: 'DELETE',
            })
            router.replace('/account/login')
            router.refresh()
        } finally {
            setLoggingOut(false)
        }
    }

    if (isLoginRoute) {
        return <>{children}</>
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

    const getActiveTab = (): TabId => {
        if (pathname.includes('/leaderboard')) return 'leaderboard'
        if (pathname.includes('/users')) return 'users'
        if (pathname.includes('/models')) return 'models'
        if (pathname.includes('/analytics')) return 'analytics'
        return 'personal'
    }

    const activeTab = getActiveTab()

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

    const isAdminRoute =
        pathname.startsWith('/account/users') ||
        pathname.startsWith('/account/models') ||
        pathname.startsWith('/account/analytics')

    if (isAdminRoute && !isAdmin) {
        return null
    }

    const tabs: {
        id: TabId
        label: string
        icon: React.ReactNode
        adminOnly?: boolean
    }[] = [
        {
            id: 'personal',
            label: t('userPortal.account.tabs.personal'),
            icon: <User className="h-4 w-4" />,
        },
        {
            id: 'leaderboard',
            label: t('userPortal.account.tabs.leaderboard'),
            icon: <BarChart3 className="h-4 w-4" />,
        },
        {
            id: 'users',
            label: t('userPortal.account.tabs.users'),
            icon: <Users className="h-4 w-4" />,
            adminOnly: true,
        },
        {
            id: 'models',
            label: t('userPortal.account.tabs.models'),
            icon: <Database className="h-4 w-4" />,
            adminOnly: true,
        },
        {
            id: 'analytics',
            label: t('userPortal.account.tabs.analytics'),
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
                                            label: 'Chinese',
                                            onClick: () =>
                                                handleLanguageChange('zh'),
                                        },
                                        {
                                            key: 'es',
                                            label: 'Spanish',
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

                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {visibleTabs.map((tab) => (
                            <Link
                                key={tab.id}
                                href={`/account/${tab.id}`}
                                className={`flex items-center gap-2 whitespace-nowrap border-b px-3 py-2 text-xs transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-foreground text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                                aria-current={
                                    activeTab === tab.id ? 'page' : undefined
                                }
                            >
                                {tab.icon}
                                {tab.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

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

            {isAdmin && (
                <DatabaseBackup
                    isOpen={isBackupModalOpen}
                    onClose={() => setIsBackupModalOpen(false)}
                />
            )}

            <div className="mx-auto max-w-6xl px-4 py-4">{children}</div>
        </div>
    )
}
