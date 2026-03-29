export async function copyTextToClipboard(text: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('Clipboard is not available')
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    try {
        const copied = document.execCommand('copy')
        if (!copied) {
            throw new Error('Clipboard is not available')
        }
    } finally {
        document.body.removeChild(textarea)
    }
}
