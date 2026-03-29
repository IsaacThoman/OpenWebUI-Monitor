'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function HtmlLangWrapper() {
    const { i18n } = useTranslation()

    useEffect(() => {
        const langMap: Record<string, string> = {
            en: 'en',
            zh: 'zh-CN',
            es: 'es',
        }

        const lang = langMap[i18n.resolvedLanguage || i18n.language] || 'en'
        document.documentElement.lang = lang
    }, [i18n.language, i18n.resolvedLanguage])

    return null
}
