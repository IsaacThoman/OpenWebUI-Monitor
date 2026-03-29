'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    BarChart3,
    Clock3,
    Loader2,
    LogOut,
    Sparkles,
    Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function AccountPage() {
    const [data, setData] = useState<UserPortalResponse['data'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [loggingOut, setLoggingOut] = useState(false)
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

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="flex items-center gap-3 text-sm text-slate-300">
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
        <div className="min-h-screen bg-slate-950 px-6 py-8 text-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-3">
                        <Badge className="w-fit bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                            {t('userPortal.account.badge')}
                        </Badge>
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">
                                {data.profile.name}
                            </h1>
                            <p className="mt-1 text-sm text-slate-300">
                                {data.profile.email}
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
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
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <Wallet className="h-4 w-4 text-emerald-300" />
                                {t('userPortal.account.cards.balance')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">
                                {formatCurrency(
                                    data.profile.balance,
                                    currencySymbol
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <BarChart3 className="h-4 w-4 text-sky-300" />
                                {t('userPortal.account.cards.totalCalls')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">
                                {formatNumber(data.overview.totalCalls)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <Sparkles className="h-4 w-4 text-violet-300" />
                                {t('userPortal.account.cards.totalTokens')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-semibold">
                                {formatNumber(data.overview.totalTokens)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                <Clock3 className="h-4 w-4 text-amber-300" />
                                {t('userPortal.account.cards.lastActive')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-medium text-white">
                                {formatDate(
                                    data.overview.lastUseTime,
                                    t('userPortal.account.never')
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader>
                            <CardTitle>
                                {t('userPortal.account.recentActivity.title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.recentActivity.calls'
                                        )}
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {formatNumber(
                                            data.recentWindow.totalCalls
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.recentActivity.tokens'
                                        )}
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {formatNumber(
                                            data.recentWindow.totalTokens
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.recentActivity.cost'
                                        )}
                                    </div>
                                    <div className="mt-1 text-xl font-semibold">
                                        {formatCurrency(
                                            data.recentWindow.totalCost,
                                            currencySymbol
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-3">
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.overview.totalSpend'
                                        )}
                                    </div>
                                    <div className="mt-1 text-base font-semibold">
                                        {formatCurrency(
                                            data.overview.totalCost,
                                            currencySymbol
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.overview.averageCost'
                                        )}
                                    </div>
                                    <div className="mt-1 text-base font-semibold">
                                        {formatCurrency(
                                            data.overview.averageCost,
                                            currencySymbol
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">
                                        {t(
                                            'userPortal.account.overview.firstUse'
                                        )}
                                    </div>
                                    <div className="mt-1 text-base font-semibold">
                                        {formatDate(
                                            data.overview.firstUseTime,
                                            t('userPortal.account.never')
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-white/5 text-white">
                        <CardHeader>
                            <CardTitle>
                                {t('userPortal.account.topModels.title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data.topModels.length === 0 ? (
                                    <div className="text-sm text-slate-400">
                                        {t('userPortal.account.empty')}
                                    </div>
                                ) : (
                                    data.topModels.map((model) => (
                                        <div
                                            key={model.modelName}
                                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-white">
                                                        {model.modelName}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-400">
                                                        {formatNumber(
                                                            model.totalCalls
                                                        )}{' '}
                                                        {t(
                                                            'userPortal.account.topModels.calls'
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm font-medium text-emerald-300">
                                                    {formatCurrency(
                                                        model.totalCost,
                                                        currencySymbol
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-white/10 bg-white/5 text-white">
                    <CardHeader>
                        <CardTitle>
                            {t('userPortal.account.records.title')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-left text-slate-400">
                                    <tr className="border-b border-white/10">
                                        <th className="pb-3 pr-4 font-medium">
                                            {t(
                                                'userPortal.account.records.time'
                                            )}
                                        </th>
                                        <th className="pb-3 pr-4 font-medium">
                                            {t(
                                                'userPortal.account.records.model'
                                            )}
                                        </th>
                                        <th className="pb-3 pr-4 font-medium">
                                            {t(
                                                'userPortal.account.records.tokens'
                                            )}
                                        </th>
                                        <th className="pb-3 pr-4 font-medium">
                                            {t(
                                                'userPortal.account.records.cost'
                                            )}
                                        </th>
                                        <th className="pb-3 font-medium">
                                            {t(
                                                'userPortal.account.records.balanceAfter'
                                            )}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recentRecords.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="py-6 text-center text-slate-400"
                                            >
                                                {t('userPortal.account.empty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        data.recentRecords.map((record) => (
                                            <tr
                                                key={record.id}
                                                className="border-b border-white/5 align-top"
                                            >
                                                <td className="py-3 pr-4 text-slate-300">
                                                    {formatDate(
                                                        record.useTime,
                                                        '-'
                                                    )}
                                                </td>
                                                <td className="py-3 pr-4 font-medium text-white">
                                                    {record.modelName}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-300">
                                                    {formatNumber(
                                                        record.totalTokens
                                                    )}
                                                </td>
                                                <td className="py-3 pr-4 text-slate-300">
                                                    {formatCurrency(
                                                        record.cost,
                                                        currencySymbol
                                                    )}
                                                </td>
                                                <td className="py-3 text-slate-300">
                                                    {formatCurrency(
                                                        record.balanceAfter,
                                                        currencySymbol
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
