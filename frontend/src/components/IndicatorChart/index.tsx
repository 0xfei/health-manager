import { useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { IndicatorChartData } from '../../types'

interface Props {
  data: IndicatorChartData
  height?: number
}

export default function IndicatorChart({ data, height = 280 }: Props) {
  const dates = data.data.map(d => d.date)
  const values = data.data.map(d => d.value)

  const markLines: unknown[] = []

  if (data.ref_min != null)
    markLines.push({
      yAxis: data.ref_min,
      name: '正常下限',
      lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
      label: { formatter: `正常下限 ${data.ref_min}`, position: 'end', color: '#52c41a', fontSize: 11 },
    })
  if (data.ref_max != null)
    markLines.push({
      yAxis: data.ref_max,
      name: '正常上限',
      lineStyle: { color: '#52c41a', type: 'dashed', width: 1 },
      label: { formatter: `正常上限 ${data.ref_max}`, position: 'end', color: '#52c41a', fontSize: 11 },
    })
  if (data.warn_low != null)
    markLines.push({
      yAxis: data.warn_low,
      name: '预警下限',
      lineStyle: { color: '#ff4d4f', type: 'dotted', width: 1.5 },
      label: { formatter: `预警 ${data.warn_low}`, position: 'end', color: '#ff4d4f', fontSize: 11 },
    })
  if (data.warn_high != null)
    markLines.push({
      yAxis: data.warn_high,
      name: '预警上限',
      lineStyle: { color: '#ff4d4f', type: 'dotted', width: 1.5 },
      label: { formatter: `预警 ${data.warn_high}`, position: 'end', color: '#ff4d4f', fontSize: 11 },
    })

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown[]) => {
        const p = params[0] as { name: string; value: number | null }
        return `${p.name}<br/><b>${p.value ?? '—'} ${data.unit ?? ''}</b>`
      },
    },
    grid: { left: 50, right: 80, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 11, color: '#6b7280', rotate: dates.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#e8edf4' } },
    },
    yAxis: {
      type: 'value',
      name: data.unit ?? '',
      nameTextStyle: { color: '#9ca3af', fontSize: 11 },
      axisLabel: { fontSize: 11, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f0f4f8' } },
    },
    series: [
      {
        name: data.indicator_name,
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#3b6cbf', width: 2 },
        itemStyle: { color: '#3b6cbf' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,108,191,0.15)' },
              { offset: 1, color: 'rgba(59,108,191,0.01)' },
            ],
          },
        },
        markLine: markLines.length ? { silent: true, data: markLines } : undefined,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
