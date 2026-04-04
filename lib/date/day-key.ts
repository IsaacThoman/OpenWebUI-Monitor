const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

interface DayKeyParts {
    year: number
    month: number
    day: number
}

export function normalizeDayKey(value: string): string | null {
    const match = DAY_KEY_PATTERN.exec(value)

    if (!match) {
        return null
    }

    return `${match[1]}-${match[2]}-${match[3]}`
}

export function compareDayKeys(a: string, b: string): number {
    return a.localeCompare(b)
}

function parseDayKey(dayKey: string): DayKeyParts | null {
    const normalizedDayKey = normalizeDayKey(dayKey)

    if (!normalizedDayKey) {
        return null
    }

    const [year, month, day] = normalizedDayKey.split('-').map(Number)

    return {
        year,
        month,
        day,
    }
}

export function dayKeyToDisplayDate(dayKey: string): Date | null {
    const parts = parseDayKey(dayKey)

    if (!parts) {
        return null
    }

    // Use local noon so a date-only key never shifts across timezones or DST.
    return new Date(parts.year, parts.month - 1, parts.day, 12)
}

export function formatDayKey(
    dayKey: string,
    options: Intl.DateTimeFormatOptions
): string {
    const displayDate = dayKeyToDisplayDate(dayKey)

    if (!displayDate) {
        return dayKey
    }

    return displayDate.toLocaleDateString(undefined, options)
}
