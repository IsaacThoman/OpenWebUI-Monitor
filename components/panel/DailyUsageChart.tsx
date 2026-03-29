'use client'

import { useRef, useEffect, useMemo } from 'react'
import { Skeleton } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ECharts } from 'echarts'
import { useTranslation } from 'react-i18next'
import {
    BarChartOutlined,
    DollarOutlined,
    LineChartOutlined,
} from '@ant-design/icons'
import { cn } from '@/lib/utils'

interface ModelUsage {
    name: string
    cost: number
    tokens: number
    calls: number
}

interface DailyUsage {
    date: string
    totalCost: number
    totalTokens: number
    totalCalls: number
    models: ModelUsage[]
}

interface DailyUsageChartProps {
    loading: boolean
    data: DailyUsage[]
    periodDayCount: number
    metric: 'cost' | 'tokens' | 'calls'
    onMetricChange: (metric: 'cost' | 'tokens' | 'calls') => void
}

interface TooltipParam {
    dataIndex?: number
    value: number
    color: string
    seriesName: string
}

function formatMetricValue(
    value: number,
    metric: 'cost' | 'tokens' | 'calls',
    t: (key: string) => string
): string {
    if (metric === 'cost') {
        return `${t('common.currency')}${value.toFixed(4)}`
    }

    if (metric === 'tokens') {
        return `${Math.round(value).toLocaleString()} Tokens`
    }

    return `${Math.round(value).toLocaleString()} calls`
}

function getMetricLabel(metric: 'cost' | 'tokens' | 'calls'): string {
    if (metric === 'cost') {
        return 'USD'
    }

    if (metric === 'tokens') {
        return 'Tokens'
    }

    return 'Calls'
}

function getMetricTitle(metric: 'cost' | 'tokens' | 'calls'): string {
    if (metric === 'cost') {
        return 'Daily USD Usage'
    }

    if (metric === 'tokens') {
        return 'Daily Token Usage'
    }

    return 'Daily Calls'
}

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    })
}

// Chart colors for different models
const CHART_COLORS = [
    'hsl(220 70% 55%)',
    'hsl(160 60% 45%)',
    'hsl(30 80% 50%)',
    'hsl(280 60% 55%)',
    'hsl(340 65% 55%)',
    'hsl(190 65% 45%)',
    'hsl(85 45% 45%)',
    'hsl(15 70% 55%)',
]

const OTHER_COLOR = 'hsl(220 15% 45%)'

const getBarOption = (
    data: DailyUsage[],
    metric: 'cost' | 'tokens' | 'calls',
    globalModels: string[],
    t: (key: string) => string
) => {
    const sortedData = [...data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const trackedModels = globalModels.filter(
        (modelName) => modelName !== 'Other'
    )

    const isSmallScreen = window.innerWidth < 640

    const orderedModels = [
        ...globalModels.filter((modelName) => modelName === 'Other'),
        ...globalModels.filter((modelName) => modelName !== 'Other').reverse(),
    ]
    const legendModels = [
        ...globalModels.filter((modelName) => modelName !== 'Other'),
        ...globalModels.filter((modelName) => modelName === 'Other'),
    ]

    const series = orderedModels.map((modelName, index) => {
        const color =
            modelName === 'Other'
                ? OTHER_COLOR
                : CHART_COLORS[index % CHART_COLORS.length]
        return {
            name: modelName,
            type: 'bar',
            stack: 'total',
            emphasis: {
                focus: 'none',
                disabled: true,
            },
            select: {
                disabled: true,
            },
            itemStyle: {
                color,
            },
            barWidth: '60%',
            data: sortedData.map((day) => {
                const dailyTrackedModels = day.models
                    .filter((model) => trackedModels.includes(model.name))
                    .sort((a, b) => {
                        const aValue =
                            metric === 'cost'
                                ? a.cost
                                : metric === 'tokens'
                                  ? a.tokens
                                  : a.calls
                        const bValue =
                            metric === 'cost'
                                ? b.cost
                                : metric === 'tokens'
                                  ? b.tokens
                                  : b.calls

                        return bValue - aValue
                    })
                const dailyVisibleModels = dailyTrackedModels
                    .slice(0, 4)
                    .map((model) => model.name)

                if (modelName === 'Other') {
                    const otherValue = day.models
                        .filter((m) => !dailyVisibleModels.includes(m.name))
                        .reduce(
                            (sum, m) =>
                                sum +
                                (metric === 'cost'
                                    ? m.cost
                                    : metric === 'tokens'
                                      ? m.tokens
                                      : m.calls),
                            0
                        )
                    return otherValue
                }

                if (!dailyVisibleModels.includes(modelName)) {
                    return 0
                }

                const model = day.models.find((m) => m.name === modelName)
                return model
                    ? metric === 'cost'
                        ? model.cost
                        : metric === 'tokens'
                          ? model.tokens
                          : model.calls
                    : 0
            }),
        }
    })

    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
            },
            backgroundColor: 'hsl(220 15% 12%)',
            borderColor: 'hsl(220 15% 18%)',
            borderWidth: 1,
            padding: [12, 16],
            textStyle: {
                color: 'hsl(220 15% 90%)',
                fontSize: 12,
                lineHeight: 18,
            },
            formatter: (params: TooltipParam[]) => {
                const dataIndex = params[0]?.dataIndex ?? 0
                const day = sortedData[dataIndex]
                const date = new Date(day.date)
                const dateStr = date.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })

                const totalValue = params.reduce(
                    (sum, p) => sum + (p.value || 0),
                    0
                )
                const totalStr = formatMetricValue(totalValue, metric, t)

                const rows = [...params]
                    .filter((p) => p.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map((p) => {
                        const value = p.value
                        const valueStr = formatMetricValue(value, metric, t)
                        return `
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                  <span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>
                  <span style="color:hsl(220 15% 75%)">${p.seriesName}</span>
                </div>
                <span style="color:hsl(220 15% 90%);font-family:monospace">${valueStr}</span>
              </div>
            `
                    })
                    .join('')

                return `
          <div class="flex flex-col gap-2">
            <div class="font-medium" style="color: hsl(220 15% 90%)">${dateStr}</div>
            <div class="text-xs" style="color: hsl(220 15% 55%); border-bottom: 1px solid hsl(220 15% 25%); padding-bottom: 4px;">
              ${getMetricLabel(metric)}: <span style="color: hsl(220 15% 90%); font-family: monospace">${totalStr}</span>
            </div>
            ${rows}
          </div>
        `
            },
        },
        legend: {
            show: true,
            top: 0,
            right: 0,
            itemWidth: 12,
            itemHeight: 12,
            textStyle: {
                fontSize: 11,
                color: 'hsl(220 15% 65%)',
            },
            data: legendModels,
        },
        grid: {
            top: isSmallScreen ? '20%' : '15%',
            bottom: isSmallScreen ? '15%' : '12%',
            left: '4%',
            right: '4%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: sortedData.map((item) => formatDate(item.date)),
            axisLabel: {
                inside: false,
                color: 'hsl(220 15% 55%)',
                fontSize: 11,
                rotate: isSmallScreen ? 45 : 0,
                interval: Math.floor(
                    sortedData.length / (isSmallScreen ? 4 : 8)
                ),
                hideOverlap: true,
            },
            axisTick: {
                show: false,
            },
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
            z: 10,
        },
        yAxis: {
            type: 'value',
            name: '',
            nameTextStyle: {
                color: 'hsl(220 15% 55%)',
                fontSize: 12,
                padding: [0, 0, 0, 0],
            },
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'hsl(220 15% 18%)',
                    width: 1,
                },
            },
            axisLabel: {
                color: 'hsl(220 15% 55%)',
                fontSize: 11,
                formatter: (value: number) => {
                    if (metric === 'cost') {
                        return `${t('common.currency')}${value.toFixed(1)}`
                    }
                    if (metric === 'calls') {
                        return `${value}`
                    }
                    if (value >= 1000) {
                        return `${(value / 1000).toFixed(1)}k`
                    }
                    return `${value}`
                },
            },
        },
        series,
        animation: true,
        animationDuration: 300,
    }
}

export default function DailyUsageChart({
    loading,
    data,
    periodDayCount,
    metric,
    onMetricChange,
}: DailyUsageChartProps) {
    const { t } = useTranslation('common')
    const chartRef = useRef<ECharts>()

    // Track the top 8 models globally for legend/options.
    const globalModels = useMemo(() => {
        if (!data || data.length === 0) return []

        // Aggregate model usage across all days
        const modelTotals = new Map<string, number>()

        for (const day of data) {
            for (const model of day.models) {
                const current = modelTotals.get(model.name) || 0
                modelTotals.set(
                    model.name,
                    current +
                        (metric === 'cost'
                            ? model.cost
                            : metric === 'tokens'
                              ? model.tokens
                              : model.calls)
                )
            }
        }

        const sortedModels = Array.from(modelTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)

        const top8 = sortedModels.slice(0, 8)
        const hasOthers = sortedModels.length > 4

        return hasOthers ? [...top8, 'Other'] : top8
    }, [data, metric])

    const averageStats = useMemo(() => {
        if (data.length === 0 || periodDayCount <= 0) {
            return {
                averageSpend: 0,
                averageTokens: 0,
                averageCalls: 0,
            }
        }

        const totals = data.reduce(
            (acc, day) => {
                acc.cost += day.totalCost
                acc.tokens += day.totalTokens
                acc.calls += day.totalCalls
                return acc
            },
            { cost: 0, tokens: 0, calls: 0 }
        )

        return {
            averageSpend: totals.cost / periodDayCount,
            averageTokens: totals.tokens / periodDayCount,
            averageCalls: totals.calls / periodDayCount,
        }
    }, [data, periodDayCount])

    const title = getMetricTitle(metric)

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.resize()
                chartRef.current.setOption(
                    getBarOption(data, metric, globalModels, t)
                )
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [metric, data, globalModels, t])

    return (
        <div className="border overflow-hidden">
            <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <h3 className="text-sm font-medium">{title}</h3>
                    </div>
                    <div className="sm:ml-auto">
                        <div
                            className={cn(
                                'flex gap-1 w-full sm:w-[320px] p-1 border',
                                'bg-muted border-border'
                            )}
                        >
                            <button
                                onClick={() => onMetricChange('cost')}
                                className={cn(
                                    'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                                    'transition-colors',
                                    metric === 'cost'
                                        ? 'bg-background text-foreground border border-border'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <DollarOutlined className="text-[12px]" />
                                USD
                            </button>

                            <button
                                onClick={() => onMetricChange('tokens')}
                                className={cn(
                                    'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                                    'transition-colors',
                                    metric === 'tokens'
                                        ? 'bg-background text-foreground border border-border'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <BarChartOutlined className="text-[12px]" />
                                Tokens
                            </button>

                            <button
                                onClick={() => onMetricChange('calls')}
                                className={cn(
                                    'relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                                    'transition-colors',
                                    metric === 'calls'
                                        ? 'bg-background text-foreground border border-border'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <LineChartOutlined className="text-[12px]" />
                                Calls
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="h-[200px] sm:h-[250px] flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="h-[200px] sm:h-[250px] flex items-center justify-center text-xs text-muted-foreground">
                        {t('userPortal.account.empty')}
                    </div>
                ) : (
                    <>
                        <div className="h-[200px] sm:h-[250px]">
                            <ReactECharts
                                option={getBarOption(
                                    data,
                                    metric,
                                    globalModels,
                                    t
                                )}
                                style={{ height: '100%', width: '100%' }}
                                onChartReady={(instance) =>
                                    (chartRef.current = instance)
                                }
                                className="bar-chart"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-px border bg-border sm:grid-cols-3">
                            <div className="bg-background px-4 py-3">
                                <p className="text-xs text-muted-foreground">
                                    Avg. spend per day
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                    {formatMetricValue(
                                        averageStats.averageSpend,
                                        'cost',
                                        t
                                    )}
                                </p>
                            </div>
                            <div className="bg-background px-4 py-3">
                                <p className="text-xs text-muted-foreground">
                                    Avg. tokens per day
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                    {formatMetricValue(
                                        averageStats.averageTokens,
                                        'tokens',
                                        t
                                    )}
                                </p>
                            </div>
                            <div className="bg-background px-4 py-3">
                                <p className="text-xs text-muted-foreground">
                                    Avg. calls per day
                                </p>
                                <p className="mt-1 text-sm font-medium">
                                    {formatMetricValue(
                                        averageStats.averageCalls,
                                        'calls',
                                        t
                                    )}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
