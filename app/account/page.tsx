'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

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

    const handleCopyLoginUrl = () => {
        if (!data?.profile.viewerToken) return

        const loginUrl = `${window.location.origin}/u/${data.profile.viewerToken}`
        navigator.clipboard.writeText(loginUrl)
        setCopied(true)
        toast.success(t('userPortal.account.copyUrl.success'))
        setTimeout(() => setCopied(false), 2000)
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

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-white">
                            {data.profile.name}
                        </h1>
                        <p className="mt-1 text-sm text-slate-400">
                            {data.profile.email}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
                                {data.profile.role}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:items-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-400 hover:text-white"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <LogOut className="mr-2 h-4 w-4" />
                            )}
                            {t('userPortal.account.logout')}
                        </Button>

                        {data.profile.viewerToken && (
                            <div className="flex items-center gap-2">
                                <code className="hidden rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 sm:block">
                                    {window.location.origin}/u/
                                    {data.profile.viewerToken.slice(0, 8)}...
                                </code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-slate-400 hover:text-white"
                                    onClick={handleCopyLoginUrl}
                                >
                                    {copied ? (
                                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    {copied
                                        ? t('userPortal.account.copyUrl.copied')
                                        : t('userPortal.account.copyUrl.label')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid - Compact */}
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
                    {/* Left Column - Usage Stats */}
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
                                            {data.recentRecords.map(
                                                (record) => (
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
                                                                {
                                                                    record.modelName
                                                                }
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
                                                )
                                            )}
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
                                        {t(
                                            'userPortal.account.topModels.title'
                                        )}
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

                        {/* Quick Links / Info */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                                Quick Access
                            </h3>
                            <div className="space-y-2">
                                <a
                                    href="/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 rounded-md p-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    OpenWebUI Dashboard
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
