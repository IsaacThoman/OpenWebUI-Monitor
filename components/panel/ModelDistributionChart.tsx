'use client'

import { useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import type { ECharts } from 'echarts'
import { Card as ShadcnCard } from '@/components/ui/card'
import { MetricToggle } from '@/components/ui/metric-toggle'
import { useTranslation } from 'react-i18next'
import { PieChartOutlined } from '@ant-design/icons'
import { Skeleton } from '@/components/ui/skeleton'

interface ModelUsage {
    model_name: string
    total_cost: number
    total_count: number
}

interface ModelDistributionChartProps {
    loading: boolean
    models: ModelUsage[]
    metric: 'cost' | 'count'
    onMetricChange: (metric: 'cost' | 'count') => void
}

const getPieOption = (
    models: ModelUsage[],
    metric: 'cost' | 'count',
    t: (key: string) => string
) => {
    const pieData = models
        .map((item) => ({
            type: item.model_name,
            value:
                metric === 'cost' ? Number(item.total_cost) : item.total_count,
        }))
        .filter((item) => item.value > 0)

    const total = pieData.reduce((sum, item) => sum + item.value, 0)

    const sortedData = [...pieData]
        .sort((a, b) => b.value - a.value)
        .reduce(
            (acc, curr) => {
                const percentage = (curr.value / total) * 100
                if (percentage < 5) {
                    const otherIndex = acc.findIndex(
                        (item) => item.name === t('panel.modelUsage.others')
                    )
                    if (otherIndex >= 0) {
                        acc[otherIndex].value += curr.value
                    } else {
                        acc.push({
                            name: t('panel.modelUsage.others'),
                            value: curr.value,
                        })
                    }
                } else {
                    acc.push({
                        name: curr.type,
                        value: curr.value,
                    })
                }
                return acc
            },
            [] as { name: string; value: number }[]
        )

    const isSmallScreen = window.innerWidth < 640

    return {
        tooltip: {
            show: true,
            trigger: 'item',
            backgroundColor: 'hsl(220 15% 12%)',
            borderColor: 'hsl(220 15% 18%)',
            borderWidth: 1,
            padding: [12, 16],
            textStyle: {
                color: 'hsl(220 15% 90%)',
                fontSize: 12,
                lineHeight: 18,
            },
            formatter: (params: any) => {
                const percentage = ((params.value / total) * 100).toFixed(1)
                return `
          <div class="flex flex-col gap-1">
            <div class="font-medium" style="color: hsl(220 15% 90%)">${params.name}</div>
            <div class="flex items-center gap-2">
              <span class="text-xs" style="color: hsl(220 15% 55%)">
                ${metric === 'cost' ? t('panel.byAmount') : t('panel.byCount')}
              </span>
              <span class="font-mono text-sm font-medium" style="color: hsl(220 15% 90%)">
                ${
                    metric === 'cost'
                        ? `${t('common.currency')}${params.value.toFixed(4)}`
                        : `${params.value} ${t('common.count')}`
                }
              </span>
            </div>
            <div class="text-xs" style="color: hsl(220 15% 50%)">
              <span>${percentage}%</span>
            </div>
          </div>
        `
            },
        },
        legend: {
            show: true,
            orient: 'horizontal',
            bottom: isSmallScreen ? 20 : 10,
            type: 'scroll',
            itemWidth: 12,
            itemHeight: 12,
            itemGap: 16,
            textStyle: {
                fontSize: 12,
                color: 'hsl(220 15% 55%)',
                padding: [0, 0, 0, 4],
            },
            pageIconSize: 10,
            pageTextStyle: {
                color: 'hsl(220 15% 40%)',
            },
        },
        series: [
            {
                name:
                    metric === 'cost'
                        ? t('panel.byAmount')
                        : t('panel.byCount'),
                type: 'pie',
                radius: isSmallScreen ? ['35%', '65%'] : ['45%', '75%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderWidth: 2,
                    borderColor: 'hsl(220 15% 8%)',
                },
                label: {
                    show: !isSmallScreen,
                    position: 'outside',
                    alignTo: 'labelLine',
                    margin: 6,
                    formatter: (params: any) => {
                        const percentage = (
                            (params.value / total) *
                            100
                        ).toFixed(1)
                        return [
                            `{name|${params.name}}`,
                            `{value|${
                                metric === 'cost'
                                    ? `${t('common.currency')}${params.value.toFixed(4)}`
                                    : `${params.value} ${t('common.count')}`
                            }}`,
                            `{per|${percentage}%}`,
                        ].join('\n')
                    },
                    rich: {
                        name: {
                            fontSize: 12,
                            color: 'hsl(220 15% 85%)',
                            padding: [0, 0, 2, 0],
                            fontWeight: 500,
                            width: 100,
                            overflow: 'break',
                        },
                        value: {
                            fontSize: 11,
                            color: 'hsl(220 15% 55%)',
                            padding: [2, 0],
                            fontFamily: 'monospace',
                        },
                        per: {
                            fontSize: 11,
                            color: 'hsl(220 15% 50%)',
                            padding: [2, 0, 0, 0],
                        },
                    },
                    lineHeight: 14,
                },
                labelLayout: {
                    hideOverlap: true,
                    moveOverlap: 'shiftY',
                },
                labelLine: {
                    show: !isSmallScreen,
                    length: 16,
                    length2: 16,
                    minTurnAngle: 90,
                    maxSurfaceAngle: 90,
                    smooth: true,
                },
                data: sortedData,
                zlevel: 0,
                emphasis: {
                    scale: true,
                    scaleSize: 4,
                    focus: 'self',
                    itemStyle: {
                        shadowBlur: 0,
                    },
                    label: {
                        show: !isSmallScreen,
                    },
                    labelLine: {
                        show: !isSmallScreen,
                    },
                },
                select: {
                    disabled: true,
                },
            },
        ],
        graphic: [
            {
                type: 'text',
                left: 'center',
                top: '40%',
                style: {
                    text:
                        metric === 'cost'
                            ? `${t('common.total')}\n${t('common.currency')}${total.toFixed(
                                  2
                              )}`
                            : `${t('common.total')}\n${total}${t('common.count')}`,
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: '500',
                    lineHeight: 20,
                    fill: 'hsl(220 15% 55%)',
                },
                zlevel: 2,
            },
        ],
        animation: true,
        animationDuration: 300,
        universalTransition: true,
    }
}

export default function ModelDistributionChart({
    loading,
    models,
    metric,
    onMetricChange,
}: ModelDistributionChartProps) {
    const chartRef = useRef<ECharts>()
    const { t } = useTranslation('common')

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.resize()
                chartRef.current.setOption(getPieOption(models, metric, t))
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [metric, models, t])

    return (
        <div className="col-span-full border overflow-hidden">
            <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 bg-muted flex items-center justify-center shrink-0">
                            <PieChartOutlined className="text-base text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-medium">
                            {t('panel.modelUsage.title')}
                        </h3>
                    </div>
                    <div className="sm:ml-auto">
                        <MetricToggle
                            value={metric}
                            onChange={onMetricChange}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="h-[300px] sm:h-[400px] flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                    </div>
                ) : (
                    <div className="h-[300px] sm:h-[400px]">
                        <ReactECharts
                            option={getPieOption(models, metric, t)}
                            style={{ height: '100%', width: '100%' }}
                            onChartReady={(instance) =>
                                (chartRef.current = instance)
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
