import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { INRTimelinePoint } from '../../types'

interface Props {
  data: INRTimelinePoint[]
  height?: number
  targetMin?: number
  targetMax?: number
  warnLow?: number
  warnHigh?: number
}

export default function INRDoseChart({
  data,
  height = 360,
  targetMin = 2.0,
  targetMax = 3.0,
  warnLow = 1.8,
  warnHigh = 3.5,
}: Props) {
  const dates = data.map(d => d.date)
  const inrValues = data.map(d => d.inr_value)
  const doseValues = data.map(d => d.warfarin_dose)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: unknown[]) => {
        const ps = params as Array<{ seriesName: string; value: number | null; axisValue: string }>
        let s = `<b>${ps[0]?.axisValue}</b><br/>`
        ps.forEach(p => {
          if (p.value != null) s += `${p.seriesName}: <b>${p.value}</b><br/>`
        })
        return s
      },
    },
    legend: {
      data: ['INR 值', '华法林剂量(mg)'],
      top: 4,
      textStyle: { fontSize: 12 },
    },
    grid: { left: 55, right: 65, top: 40, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 11, color: '#6b7280', rotate: dates.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: '#e8edf4' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'INR',
        nameTextStyle: { color: '#3b6cbf', fontSize: 11 },
        min: 0,
        max: (v: { max: number }) => Math.max(v.max + 0.5, 4.5),
        axisLabel: { fontSize: 11, color: '#3b6cbf' },
        splitLine: { lineStyle: { color: '#f0f4f8' } },
      },
      {
        type: 'value',
        name: '剂量 mg',
        nameTextStyle: { color: '#d97706', fontSize: 11 },
        axisLabel: { fontSize: 11, color: '#d97706' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'INR 值',
        type: 'line',
        yAxisIndex: 0,
        data: inrValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#3b6cbf', width: 2.5 },
        itemStyle: { color: '#3b6cbf' },
        markLine: {
          silent: true,
          data: [
            {
              yAxis: targetMin,
              lineStyle: { color: '#52c41a', type: 'dashed', width: 1.5 },
              label: { formatter: `目标下限 ${targetMin}`, color: '#52c41a', fontSize: 11 },
            },
            {
              yAxis: targetMax,
              lineStyle: { color: '#52c41a', type: 'dashed', width: 1.5 },
              label: { formatter: `目标上限 ${targetMax}`, color: '#52c41a', fontSize: 11 },
            },
            {
              yAxis: warnLow,
              lineStyle: { color: '#ff4d4f', type: 'dotted', width: 1.5 },
              label: { formatter: `预警 ${warnLow}`, color: '#ff4d4f', fontSize: 11 },
            },
            {
              yAxis: warnHigh,
              lineStyle: { color: '#ff4d4f', type: 'dotted', width: 1.5 },
              label: { formatter: `预警 ${warnHigh}`, color: '#ff4d4f', fontSize: 11 },
            },
          ],
        },
        markArea: {
          silent: true,
          data: [[
            { yAxis: targetMin, itemStyle: { color: 'rgba(82,196,26,0.06)' } },
            { yAxis: targetMax },
          ]],
        },
      },
      {
        name: '华法林剂量(mg)',
        type: 'bar',
        yAxisIndex: 1,
        data: doseValues,
        barMaxWidth: 24,
        itemStyle: { color: 'rgba(217,119,6,0.65)', borderRadius: [3, 3, 0, 0] },
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
