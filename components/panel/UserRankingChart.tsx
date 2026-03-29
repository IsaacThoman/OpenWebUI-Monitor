'use client'

import { useRef, useEffect } from 'react'
import { Spin, Skeleton } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ECharts } from 'echarts'
import { MetricToggle } from '@/components/ui/metric-toggle'
import { useTranslation } from 'react-i18next'
import { BarChartOutlined } from '@ant-design/icons'
import { Card as ShadcnCard } from '@/components/ui/card'
import { motion } from 'framer-motion'

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
                color: 'rgba(148, 163, 184, 0.8)',
                fontSize: 12,
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
                    color: 'rgba(51, 65, 85, 0.6)',
                    width: 1,
                },
            },
            z: 10,
        },
        yAxis: {
            type: 'value',
            name: '',
            nameTextStyle: {
                color: 'rgba(148, 163, 184, 0.6)',
                fontSize: 13,
                padding: [0, 0, 0, 0],
            },
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(51, 65, 85, 0.6)',
                    width: 1,
                },
            },
            axisTick: {
                show: true,
                lineStyle: {
                    color: 'rgba(51, 65, 85, 0.6)',
                },
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(51, 65, 85, 0.3)',
                    width: 1,
                },
            },
            axisLabel: {
                color: 'rgba(148, 163, 184, 0.7)',
                fontSize: 12,
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
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: 'rgba(99, 133, 255, 0.85)',
                            },
                            {
                                offset: 1,
                                color: 'rgba(99, 133, 255, 0.4)',
                            },
                        ],
                    },
                    borderRadius: [8, 8, 0, 0],
                },
                emphasis: {
                    itemStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                {
                                    offset: 0,
                                    color: 'rgba(99, 133, 255, 0.95)',
                                },
                                {
                                    offset: 1,
                                    color: 'rgba(99, 133, 255, 0.5)',
                                },
                            ],
                        },
                        shadowBlur: 10,
                        shadowColor: 'rgba(99, 133, 255, 0.2)',
                    },
                },
                barWidth: '35%',
                data: columnData.map((item) => item.value),
                showBackground: true,
                backgroundStyle: {
                    color: 'rgba(99, 133, 255, 0.05)',
                    borderRadius: [8, 8, 0, 0],
                },
                label: {
                    show: !isSmallScreen,
                    position: 'top',
                    formatter: (params: any) => {
                        return metric === 'cost'
                            ? `${params.value.toFixed(2)}`
                            : `${params.value}`
                    },
                    fontSize: 11,
                    color: 'rgba(148, 163, 184, 0.8)',
                    distance: 2,
                    fontFamily: 'monospace',
                },
            },
        ],
        animation: true,
        animationDuration: 800,
        animationEasing: 'cubicOut' as const,
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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="col-span-full bg-gradient-to-br from-card to-card/95 text-card-foreground rounded-xl border shadow-sm overflow-hidden"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />

                <div className="relative p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center rounded-xl shrink-0">
                                <BarChartOutlined className="text-xl text-primary" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-semibold bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text text-transparent">
                                    {t('panel.userUsageChart.title')}
                                </h3>
                            </div>
                        </div>
                        <div className="sm:ml-auto">
                            <MetricToggle
                                value={metric}
                                onChange={onMetricChange}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-[350px] sm:h-[450px] flex items-center justify-center">
                            <Skeleton className="w-full h-full rounded-lg" />
                        </div>
                    ) : (
                        <div className="h-[350px] sm:h-[450px] transition-all duration-300">
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
        </motion.div>
    )
}
