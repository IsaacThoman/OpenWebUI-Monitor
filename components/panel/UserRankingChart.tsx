'use client'

import { useRef, useEffect } from 'react'
import { Skeleton } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ECharts } from 'echarts'
import { MetricToggle } from '@/components/ui/metric-toggle'
import { useTranslation } from 'react-i18next'
import { BarChartOutlined } from '@ant-design/icons'

interface UserUsage {
    nickname: string
    total_cost: number
    total_count: number
}

interface UserRankingChartProps {
    loading: boolean
    users: UserUsage[]
    metric: 'cost' | 'count'
    onMetricChange: (metric: 'cost' | 'count') => void
}

const getBarOption = (
    users: UserUsage[],
    metric: 'cost' | 'count',
    t: (key: string) => string
) => {
    const columnData = users
        .map((item) => ({
            nickname: item.nickname,
            value:
                metric === 'cost' ? Number(item.total_cost) : item.total_count,
        }))
        .sort((a, b) => b.value - a.value)

    const isSmallScreen = window.innerWidth < 640

    return {
        tooltip: {
            show: false,
        },
        grid: {
            top: isSmallScreen ? '8%' : '4%',
            bottom: isSmallScreen ? '2%' : '1%',
            left: '4%',
            right: '4%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: columnData.map((item) =>
                item.nickname.length > 12
                    ? item.nickname.slice(0, 10) + '...'
                    : item.nickname
            ),
            axisLabel: {
                inside: false,
                color: 'hsl(220 15% 55%)',
                fontSize: 11,
                rotate: 35,
                interval: 0,
                hideOverlap: true,
                padding: [0, 0, 0, 0],
                verticalAlign: 'middle',
                align: 'right',
                margin: 8,
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
                    return `${value}`
                },
            },
        },
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: Math.min(
                    100,
                    Math.max(100 * (15 / columnData.length), 40)
                ),
                zoomLock: true,
                moveOnMouseMove: true,
            },
        ],
        series: [
            {
                type: 'bar',
                itemStyle: {
                    color: 'hsl(220 15% 35%)',
                },
                emphasis: {
                    itemStyle: {
                        color: 'hsl(220 15% 45%)',
                    },
                },
                barWidth: '35%',
                data: columnData.map((item) => item.value),
                showBackground: true,
                backgroundStyle: {
                    color: 'hsl(220 15% 12%)',
                },
                label: {
                    show: !isSmallScreen,
                    position: 'top',
                    formatter: (params: any) => {
                        return metric === 'cost'
                            ? `${params.value.toFixed(2)}`
                            : `${params.value}`
                    },
                    fontSize: 10,
                    color: 'hsl(220 15% 55%)',
                    distance: 2,
                    fontFamily: 'monospace',
                },
            },
        ],
        animation: true,
        animationDuration: 300,
    }
}

export default function UserRankingChart({
    loading,
    users,
    metric,
    onMetricChange,
}: UserRankingChartProps) {
    const { t } = useTranslation('common')
    const chartRef = useRef<ECharts>()

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.resize()
                chartRef.current.setOption(getBarOption(users, metric, t))
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [metric, users, t])

    const onChartReady = (instance: ECharts) => {
        chartRef.current = instance
        const zoomSize = 6
        let isZoomed = false

        instance.on('click', (params) => {
            const dataLength = users.length

            if (!isZoomed) {
                instance.dispatchAction({
                    type: 'dataZoom',
                    startValue:
                        users[Math.max(params.dataIndex - zoomSize / 2, 0)]
                            .nickname,
                    endValue:
                        users[
                            Math.min(
                                params.dataIndex + zoomSize / 2,
                                dataLength - 1
                            )
                        ].nickname,
                })
                isZoomed = true
            } else {
                instance.dispatchAction({
                    type: 'dataZoom',
                    start: 0,
                    end: 100,
                })
                isZoomed = false
            }
        })
    }

    return (
        <div className="col-span-full border overflow-hidden">
            <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 bg-muted flex items-center justify-center shrink-0">
                            <BarChartOutlined className="text-base text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-medium">
                            {t('panel.userUsageChart.title')}
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
                            option={getBarOption(users, metric, t)}
                            style={{ height: '100%', width: '100%' }}
                            onChartReady={onChartReady}
                            className="bar-chart"
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
