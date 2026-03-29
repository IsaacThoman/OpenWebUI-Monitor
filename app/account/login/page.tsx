'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Link2, ShieldCheck, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function extractToken(value: string): string {
    const trimmed = value.trim()

    if (!trimmed) {
        return ''
    }

    try {
        const parsedUrl = new URL(trimmed)
        const segments = parsedUrl.pathname.split('/').filter(Boolean)

        if (segments[0] === 'u' && segments[1]) {
            return segments[1]
        }
    } catch {
        if (trimmed.includes('/u/')) {
            const segments = trimmed.split('/u/')
            return segments[segments.length - 1].split(/[?#]/)[0]
        }
    }

    return trimmed
}

function AccountLoginContent() {
    const [value, setValue] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { t } = useTranslation('common')

    useEffect(() => {
        const error = searchParams.get('error')

        if (error === 'invalid') {
            toast.error(t('userPortal.login.invalidLink'))
        }

        if (error === 'missing') {
            toast.error(t('userPortal.login.missingLink'))
        }
    }, [searchParams, t])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const token = extractToken(value)
        if (!token) {
            toast.error(t('userPortal.login.required'))
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/v1/user-portal/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || t('userPortal.login.invalidLink'))
            }

            router.replace('/account/personal')
            router.refresh()
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : t('userPortal.login.failed')
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                        <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-semibold text-white">
                        {t('userPortal.login.title')}
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        {t('userPortal.login.description')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label
                            htmlFor="viewer-token"
                            className="text-sm text-slate-300"
                        >
                            {t('userPortal.login.label')}
                        </Label>
                        <div className="relative">
                            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <Input
                                id="viewer-token"
                                value={value}
                                onChange={(event) =>
                                    setValue(event.target.value)
                                }
                                placeholder={t('userPortal.login.placeholder')}
                                className="h-11 border-slate-800 bg-slate-900 pl-10 text-white placeholder:text-slate-500 focus-visible:ring-emerald-500"
                                autoCapitalize="off"
                                autoComplete="off"
                                autoCorrect="off"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('userPortal.login.submitting')}
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                {t('userPortal.login.submit')}
                                <ArrowRight className="h-4 w-4" />
                            </span>
                        )}
                    </Button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                    {t('userPortal.login.help')}
                </p>
            </div>
        </div>
    )
}

export default function AccountLoginPage() {
    return (
        <Suspense fallback={null}>
            <AccountLoginContent />
        </Suspense>
    )
}
