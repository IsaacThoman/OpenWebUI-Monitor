const PUBLIC_URL_ENV_KEYS = ['PUBLIC_APP_URL', 'APP_URL', 'NEXT_PUBLIC_APP_URL']

function normalizeUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url
}

export function getPublicAppUrl(request: Request): string {
    for (const key of PUBLIC_URL_ENV_KEYS) {
        const value = process.env[key]
        if (value) {
            return normalizeUrl(value)
        }
    }

    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')

    if (forwardedProto && forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`
    }

    return normalizeUrl(new URL(request.url).origin)
}
