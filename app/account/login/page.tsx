'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Link2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

export default function AccountLoginPage() {
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

            router.push('/account')
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
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-slate-50">
            <AnimatedGridPattern
                numSquares={40}
                maxOpacity={0.08}
                duration={3}
                repeatDelay={1}
                className={cn(
                    'absolute inset-x-0 inset-y-[-30%] h-[160%] w-full skew-y-12 text-white/10',
                    '[mask-image:radial-gradient(900px_circle_at_center,white,transparent)]'
                )}
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_35%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),_transparent_30%)]" />

            <Card className="relative z-10 w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl">
                <CardHeader className="space-y-4 pb-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                        <ShieldCheck className="h-7 w-7 text-emerald-300" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-semibold text-white">
                            {t('userPortal.login.title')}
                        </CardTitle>
                        <p className="text-sm text-slate-300">
                            {t('userPortal.login.description')}
                        </p>
                    </div>
                </CardHeader>

                <CardContent>
                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <Label
                                htmlFor="viewer-token"
                                className="text-slate-200"
                            >
                                {t('userPortal.login.label')}
                            </Label>
                            <div className="relative">
                                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    id="viewer-token"
                                    value={value}
                                    onChange={(event) =>
                                        setValue(event.target.value)
                                    }
                                    placeholder={t(
                                        'userPortal.login.placeholder'
                                    )}
                                    className="h-12 border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-400"
                                    autoCapitalize="off"
                                    autoComplete="off"
                                    autoCorrect="off"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="h-12 w-full bg-white text-slate-950 hover:bg-slate-200"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('userPortal.login.submitting')}
                                </span>
                            ) : (
                                t('userPortal.login.submit')
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
