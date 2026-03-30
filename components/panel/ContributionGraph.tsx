'use client'

import { useMemo, useState, useCallback, useRef } from 'react'

interface DailyData {
    date: string
    totalCost: number
    totalTokens: number
    totalCalls: number
}

interface ContributionGraphProps {
    data: DailyData[]
    metric: 'cost' | 'tokens' | 'calls'
    loading?: boolean
}

interface DayCell {
    date: Date
    dateStr: string
    value: number
    level: 0 | 1 | 2 | 3 | 4
    color: string
    isPlaceholder: boolean
}

interface HslColor {
    h: number
    s: number
    l: number
}

const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
]

const CONTRIBUTION_COLOR_STOPS: HslColor[] = [
    { h: 220, s: 15, l: 14 },
    { h: 130, s: 40, l: 18 },
    { h: 130, s: 45, l: 28 },
    { h: 130, s: 50, l: 38 },
    { h: 130, s: 55, l: 48 },
]

function formatHsl(color: HslColor): string {
    return `hsl(${color.h} ${color.s}% ${color.l}%)`
}

function interpolateColor(
    start: HslColor,
    end: HslColor,
    progress: number
): string {
    const clampedProgress = Math.min(Math.max(progress, 0), 1)

    return formatHsl({
        h: start.h + (end.h - start.h) * clampedProgress,
        s: start.s + (end.s - start.s) * clampedProgress,
        l: start.l + (end.l - start.l) * clampedProgress,
    })
}

function formatLocalDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function formatMetricValue(
    value: number,
    metric: 'cost' | 'tokens' | 'calls'
): string {
    if (metric === 'cost') {
        return `$${value.toFixed(4)}`
    }
    if (metric === 'tokens') {
        return `${Math.round(value).toLocaleString()} tokens`
    }
    return `${Math.round(value).toLocaleString()} calls`
}

function getMetricLabel(metric: 'cost' | 'tokens' | 'calls'): string {
    if (metric === 'cost') return 'usage'
    if (metric === 'tokens') return 'tokens'
    return 'calls'
}

export default function ContributionGraph({
    data,
    metric,
    loading,
}: ContributionGraphProps) {
    const currentYear = new Date().getFullYear()
    const [selectedYear, setSelectedYear] = useState<'now' | number>('now')
    const [tooltip, setTooltip] = useState<{
        left: number
        top: number
        day: DayCell
        horizontalAlign: 'left' | 'center' | 'right'
        verticalAlign: 'above' | 'below'
    } | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Build a lookup map from date string -> daily data
    const dataMap = useMemo(() => {
        const map = new Map<string, DailyData>()
        for (const day of data) {
            const dateStr = day.date.slice(0, 10)
            map.set(dateStr, day)
        }
        return map
    }, [data])

    const availableYears = useMemo(() => {
        const years = new Set<number>([currentYear])

        for (const day of data) {
            const year = Number(day.date.slice(0, 4))
            if (!Number.isNaN(year)) {
                years.add(year)
            }
        }

        return Array.from(years).sort((a, b) => b - a)
    }, [currentYear, data])

    // Generate the heatmap grid for the selected range
    const { weeks, monthLabels, stats } = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const startDate = new Date(today)
        const endDate = new Date(today)

        if (selectedYear === 'now') {
            startDate.setDate(startDate.getDate() - 364)
        } else {
            startDate.setFullYear(selectedYear, 0, 1)
            endDate.setFullYear(selectedYear, 11, 31)
        }

        // Adjust start back to previous Sunday
        const startDow = startDate.getDay()
        const gridStart = new Date(startDate)
        gridStart.setDate(gridStart.getDate() - startDow)

        // Collect all positive values for quartile calculation
        const allValues: number[] = []
        const cursor = new Date(gridStart)
        while (cursor <= endDate) {
            const dateStr = formatLocalDateKey(cursor)
            const dayData = dataMap.get(dateStr)
            if (dayData) {
                const val =
                    metric === 'cost'
                        ? dayData.totalCost
                        : metric === 'tokens'
                          ? dayData.totalTokens
                          : dayData.totalCalls
                if (val > 0) allValues.push(val)
            }
            cursor.setDate(cursor.getDate() + 1)
        }

        allValues.sort((a, b) => a - b)
        let q1 = 0,
            q2 = 0,
            q3 = 0
        let maxValue = 0
        if (allValues.length > 0) {
            q1 = allValues[Math.floor(allValues.length * 0.25)] || allValues[0]
            q2 = allValues[Math.floor(allValues.length * 0.5)] || q1
            q3 = allValues[Math.floor(allValues.length * 0.75)] || q2
            maxValue = allValues[allValues.length - 1] || q3
        }

        const getLevel = (value: number): 0 | 1 | 2 | 3 | 4 => {
            if (value <= 0) return 0
            if (value <= q1) return 1
            if (value <= q2) return 2
            if (value <= q3) return 3
            return 4
        }

        const getColor = (value: number): string => {
            if (value <= 0 || maxValue <= 0) {
                return formatHsl(CONTRIBUTION_COLOR_STOPS[0])
            }

            if (value <= q1) {
                return formatHsl(CONTRIBUTION_COLOR_STOPS[1])
            }

            const thresholds = [q1, q2, q3, maxValue]

            for (let i = 0; i < thresholds.length - 1; i++) {
                const start = thresholds[i]
                const end = thresholds[i + 1]

                if (value <= end || i === thresholds.length - 2) {
                    const segmentProgress =
                        end > start ? (value - start) / (end - start) : 1

                    return interpolateColor(
                        CONTRIBUTION_COLOR_STOPS[i + 1],
                        CONTRIBUTION_COLOR_STOPS[i + 2],
                        segmentProgress
                    )
                }
            }

            return formatHsl(CONTRIBUTION_COLOR_STOPS[4])
        }

        // Build week columns
        const weeksArr: DayCell[][] = []
        const monthLabelsArr: { label: string; colIndex: number }[] = []
        let currentWeek: DayCell[] = []
        let lastMonthSeen = -1
        let colIndex = 0
        let totalVal = 0
        let activeDays = 0

        const iterCursor = new Date(gridStart)
        while (iterCursor <= endDate) {
            const dateStr = formatLocalDateKey(iterCursor)
            const isBeforeWindow = iterCursor < startDate
            const dayData = dataMap.get(dateStr)
            let value = 0
            if (!isBeforeWindow && dayData) {
                value =
                    metric === 'cost'
                        ? dayData.totalCost
                        : metric === 'tokens'
                          ? dayData.totalTokens
                          : dayData.totalCalls
            }

            // Track months — mark when a new month starts on a Sunday
            const month = iterCursor.getMonth()
            if (
                iterCursor.getDay() === 0 &&
                month !== lastMonthSeen &&
                !isBeforeWindow
            ) {
                monthLabelsArr.push({
                    label: MONTH_LABELS[month],
                    colIndex,
                })
                lastMonthSeen = month
            }

            if (!isBeforeWindow && value > 0) {
                totalVal += value
                activeDays++
            }

            currentWeek.push({
                date: new Date(iterCursor),
                dateStr,
                value: isBeforeWindow ? -1 : value,
                level: isBeforeWindow ? 0 : getLevel(value),
                color: isBeforeWindow
                    ? formatHsl(CONTRIBUTION_COLOR_STOPS[0])
                    : getColor(value),
                isPlaceholder: isBeforeWindow,
            })

            if (currentWeek.length === 7) {
                weeksArr.push(currentWeek)
                currentWeek = []
                colIndex++
            }

            iterCursor.setDate(iterCursor.getDate() + 1)
        }

        // Remaining partial week (today might not be Saturday)
        if (currentWeek.length > 0) {
            weeksArr.push(currentWeek)
        }

        return {
            weeks: weeksArr,
            monthLabels: monthLabelsArr,
            stats: { total: totalVal, activeDays },
        }
    }, [dataMap, metric, selectedYear])

    const rangeLabel =
        selectedYear === 'now' ? 'the last year' : String(selectedYear)

    const handleCellMouseEnter = useCallback(
        (e: React.MouseEvent<SVGRectElement>, day: DayCell) => {
            if (day.isPlaceholder) return
            const cellRect = e.currentTarget.getBoundingClientRect()
            const estimatedTooltipWidth = 240
            const viewportPadding = 12

            let horizontalAlign: 'left' | 'center' | 'right' = 'center'
            let left = cellRect.left + cellRect.width / 2

            if (cellRect.left < estimatedTooltipWidth / 2 + viewportPadding) {
                horizontalAlign = 'left'
                left = cellRect.left
            } else if (
                window.innerWidth - cellRect.right <
                estimatedTooltipWidth / 2 + viewportPadding
            ) {
                horizontalAlign = 'right'
                left = cellRect.right
            }

            const verticalAlign = cellRect.top < 80 ? 'below' : 'above'
            const top =
                verticalAlign === 'above'
                    ? cellRect.top - 6
                    : cellRect.bottom + 6

            setTooltip({
                left,
                top,
                day,
                horizontalAlign,
                verticalAlign,
            })
        },
        []
    )

    const handleCellMouseLeave = useCallback(() => {
        setTooltip(null)
    }, [])

    if (loading) {
        return (
            <div className="border-t p-4">
                <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">
                    Loading...
                </div>
            </div>
        )
    }

    const CELL_SIZE = 12
    const GAP = 2
    const STEP = CELL_SIZE + GAP

    return (
        <div className="border-t">
            <div className="p-4 pb-2">
                <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs font-medium text-muted-foreground">
                        {selectedYear === 'now'
                            ? `${stats.activeDays} active days in the last year`
                            : `${stats.activeDays} active days in ${selectedYear}`}
                    </h4>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                        {/* Scrollable graph area */}
                        <div
                            ref={scrollRef}
                            className="overflow-x-auto relative"
                            style={{ position: 'relative' }}
                            onScroll={handleCellMouseLeave}
                        >
                            <svg
                                width={28 + weeks.length * STEP + 4}
                                height={20 + 7 * STEP + 4}
                                style={{ display: 'block' }}
                            >
                                {/* Month labels */}
                                {monthLabels.map((ml, i) => (
                                    <text
                                        key={`month-${i}`}
                                        x={
                                            28 +
                                            ml.colIndex * STEP +
                                            CELL_SIZE / 2
                                        }
                                        y={10}
                                        textAnchor="start"
                                        className="fill-[hsl(220_15%_55%)]"
                                        style={{ fontSize: '10px' }}
                                    >
                                        {ml.label}
                                    </text>
                                ))}

                                {/* Day-of-week labels */}
                                {[1, 3, 5].map((dow) => (
                                    <text
                                        key={`dow-${dow}`}
                                        x={22}
                                        y={20 + dow * STEP + CELL_SIZE / 2 + 1}
                                        textAnchor="end"
                                        dominantBaseline="central"
                                        className="fill-[hsl(220_15%_55%)]"
                                        style={{ fontSize: '10px' }}
                                    >
                                        {dow === 1
                                            ? 'Mon'
                                            : dow === 3
                                              ? 'Wed'
                                              : 'Fri'}
                                    </text>
                                ))}

                                {/* Day cells */}
                                {weeks.map((week, wi) =>
                                    week.map((day, di) => {
                                        if (day.isPlaceholder) return null
                                        return (
                                            <rect
                                                key={day.dateStr}
                                                x={28 + wi * STEP}
                                                y={20 + di * STEP}
                                                width={CELL_SIZE}
                                                height={CELL_SIZE}
                                                rx={2}
                                                ry={2}
                                                className="contribution-cell"
                                                data-level={day.level}
                                                onMouseEnter={(e) =>
                                                    handleCellMouseEnter(e, day)
                                                }
                                                onMouseLeave={
                                                    handleCellMouseLeave
                                                }
                                                style={{
                                                    cursor: 'pointer',
                                                    fill: day.color,
                                                }}
                                            />
                                        )
                                    })
                                )}
                            </svg>
                        </div>

                        {/* Footer: total + legend */}
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">
                                {stats.total > 0
                                    ? `Total: ${formatMetricValue(stats.total, metric)}`
                                    : `No activity in ${rangeLabel}`}
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground mr-1">
                                    Less
                                </span>
                                {[0, 1, 2, 3, 4].map((level) => (
                                    <div
                                        key={level}
                                        className="contribution-cell"
                                        data-level={level}
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '2px',
                                        }}
                                    />
                                ))}
                                <span className="text-[10px] text-muted-foreground ml-1">
                                    More
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 gap-2 lg:w-24 lg:flex-col">
                        <button
                            type="button"
                            className={
                                selectedYear === 'now'
                                    ? 'rounded-md bg-[hsl(220_70%_55%)] px-3 py-2 text-xs font-medium text-white'
                                    : 'rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-[hsl(220_15%_16%)] hover:text-foreground'
                            }
                            onClick={() => {
                                setTooltip(null)
                                setSelectedYear('now')
                            }}
                        >
                            Now
                        </button>
                        {availableYears.map((year) => (
                            <button
                                key={year}
                                type="button"
                                className={
                                    selectedYear === year
                                        ? 'rounded-md bg-[hsl(220_70%_55%)] px-3 py-2 text-xs font-medium text-white'
                                        : 'rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-[hsl(220_15%_16%)] hover:text-foreground'
                                }
                                onClick={() => {
                                    setTooltip(null)
                                    setSelectedYear(year)
                                }}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tooltip */}
                {tooltip && (
                    <div
                        className="fixed z-50 pointer-events-none"
                        style={{
                            left: `${tooltip.left}px`,
                            top: `${tooltip.top}px`,
                            transform:
                                tooltip.verticalAlign === 'above'
                                    ? tooltip.horizontalAlign === 'left'
                                        ? 'translate(0, -100%)'
                                        : tooltip.horizontalAlign === 'right'
                                          ? 'translate(-100%, -100%)'
                                          : 'translate(-50%, -100%)'
                                    : tooltip.horizontalAlign === 'left'
                                      ? 'translate(0, 0)'
                                      : tooltip.horizontalAlign === 'right'
                                        ? 'translate(-100%, 0)'
                                        : 'translate(-50%, 0)',
                        }}
                    >
                        {tooltip.verticalAlign === 'below' && (
                            <div
                                style={{
                                    width: 0,
                                    height: 0,
                                    margin: '0 auto',
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderBottom: '5px solid hsl(220 15% 25%)',
                                }}
                            />
                        )}
                        <div
                            className="max-w-[min(240px,calc(100vw-16px))] px-2.5 py-1.5 text-[11px] font-medium whitespace-normal sm:whitespace-nowrap"
                            style={{
                                background: 'hsl(220 15% 12%)',
                                border: '1px solid hsl(220 15% 25%)',
                                borderRadius: '4px',
                                color: 'hsl(220 15% 90%)',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
                            }}
                        >
                            {tooltip.day.value > 0 ? (
                                <>
                                    <strong>
                                        {formatMetricValue(
                                            tooltip.day.value,
                                            metric
                                        )}
                                    </strong>{' '}
                                    on{' '}
                                    {tooltip.day.date.toLocaleDateString(
                                        undefined,
                                        {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        }
                                    )}
                                </>
                            ) : (
                                <>
                                    No {getMetricLabel(metric)} on{' '}
                                    {tooltip.day.date.toLocaleDateString(
                                        undefined,
                                        {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        }
                                    )}
                                </>
                            )}
                        </div>
                        {tooltip.verticalAlign === 'above' && (
                            <div
                                style={{
                                    width: 0,
                                    height: 0,
                                    margin: '0 auto',
                                    borderLeft: '5px solid transparent',
                                    borderRight: '5px solid transparent',
                                    borderTop: '5px solid hsl(220 15% 25%)',
                                }}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
