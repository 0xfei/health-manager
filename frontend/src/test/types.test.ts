/**
 * 前端 TypeScript 类型完整性测试
 * 确保类型定义与后端 Schema 一致
 */
import { describe, it, expect } from 'vitest'
import type {
  IndicatorDefinition, IndicatorRecord, IndicatorChartData,
  ChartDataPoint, DashboardSummary, IndicatorSummaryItem,
  SymptomRecord, ParsedSymptom, MedicationRecord,
  INRDoseLog, INRTimelinePoint, VisitRecord, IndicatorStatus,
} from '../../types'

describe('TypeScript 类型定义', () => {
  it('IndicatorDefinition 包含所有必要字段', () => {
    const def: IndicatorDefinition = {
      id: 'uuid-1',
      name: '白细胞计数',
      code: 'WBC',
      unit: '×10⁹/L',
      ref_min: 4.0,
      ref_max: 10.0,
      warn_low: 3.0,
      warn_high: 12.0,
      category: '血常规',
      description: '感染监测',
      is_system: true,
      sort_order: 1,
      created_at: '2024-01-01T00:00:00',
    }
    expect(def.code).toBe('WBC')
    expect(def.ref_min).toBe(4.0)
    expect(def.is_system).toBe(true)
  })

  it('IndicatorRecord 包含 enriched 字段', () => {
    const rec: IndicatorRecord = {
      id: 'rec-1',
      indicator_id: 'def-1',
      value: 6.5,
      value_text: null,
      recorded_at: '2024-03-15',
      source_type: 'manual',
      note: null,
      created_at: '2024-03-15T10:00:00',
      // enriched
      indicator_name: '白细胞计数',
      indicator_code: 'WBC',
      unit: '×10⁹/L',
      ref_min: 4.0,
      ref_max: 10.0,
      warn_low: 3.0,
      warn_high: 12.0,
    }
    expect(rec.value).toBe(6.5)
    expect(rec.indicator_code).toBe('WBC')
  })

  it('IndicatorChartData 包含数据点数组', () => {
    const chart: IndicatorChartData = {
      indicator_id: 'def-1',
      indicator_name: '白细胞',
      indicator_code: 'WBC',
      unit: '×10⁹/L',
      ref_min: 4.0,
      ref_max: 10.0,
      warn_low: 3.0,
      warn_high: 12.0,
      data: [
        { date: '2024-01-01', value: 5.5, value_text: null },
        { date: '2024-02-01', value: 7.0, value_text: null },
      ],
    }
    expect(chart.data).toHaveLength(2)
    expect(chart.data[0].value).toBe(5.5)
  })

  it('INRDoseLog 包含 INR 和剂量字段', () => {
    const log: INRDoseLog = {
      id: 'inr-1',
      log_date: '2024-03-15',
      inr_value: 2.4,
      warfarin_dose: 3.0,
      note: '稳定',
      next_test_date: '2024-04-15',
      created_at: '2024-03-15T10:00:00',
    }
    expect(log.inr_value).toBe(2.4)
    expect(log.warfarin_dose).toBe(3.0)
  })

  it('INRTimelinePoint 与 INRDoseLog 字段对应', () => {
    const point: INRTimelinePoint = {
      date: '2024-03-15',
      inr_value: 2.4,
      warfarin_dose: 3.0,
      note: null,
      next_test_date: null,
    }
    expect(point.date).toBe('2024-03-15')
  })

  it('DashboardSummary 包含指标列表和 INR', () => {
    const item: IndicatorSummaryItem = {
      indicator_id: 'def-1',
      indicator_name: '白细胞',
      indicator_code: 'WBC',
      unit: '×10⁹/L',
      latest_value: 6.5,
      latest_value_text: null,
      latest_date: '2024-03-15',
      ref_min: 4.0,
      ref_max: 10.0,
      warn_low: 3.0,
      warn_high: 12.0,
      status: 'normal',
    }
    const summary: DashboardSummary = {
      total_records: 10,
      last_update: '2024-03-15',
      indicators: [item],
      inr_latest: null,
      upcoming_tests: [],
    }
    expect(summary.indicators[0].status).toBe('normal')
  })

  it('IndicatorStatus 类型只允许 4 个值', () => {
    const statuses: IndicatorStatus[] = ['normal', 'warning', 'danger', 'unknown']
    expect(statuses).toHaveLength(4)
  })

  it('MedicationRecord 包含 APS 相关标识', () => {
    const med: MedicationRecord = {
      id: 'med-1',
      drug_name: '华法林',
      dosage: '3mg',
      dosage_value: 3.0,
      dosage_unit: 'mg',
      frequency: '每日一次',
      start_date: '2024-01-01',
      end_date: null,
      category: 'anticoagulant',
      is_aps_related: true,
      note: null,
      created_at: '2024-01-01T00:00:00',
    }
    expect(med.is_aps_related).toBe(true)
    expect(med.category).toBe('anticoagulant')
  })

  it('ParsedSymptom 包含分类和严重程度', () => {
    const s: ParsedSymptom = {
      symptom_name: '关节痛',
      category: '关节',
      severity: 3,
      duration: '1小时',
    }
    expect(s.category).toBe('关节')
    expect(s.severity).toBe(3)
  })
})

describe('API 数据结构模拟验证', () => {
  it('可以将 null 值处理为空字符串展示', () => {
    const displayValue = (v: number | null | undefined, text: string | null | undefined): string => {
      if (v != null) return String(v)
      if (text != null) return text
      return '—'
    }
    expect(displayValue(6.5, null)).toBe('6.5')
    expect(displayValue(null, '阳性')).toBe('阳性')
    expect(displayValue(null, null)).toBe('—')
  })

  it('日期字符串格式验证', () => {
    const isValidDate = (s: string | null): boolean => {
      if (!s) return false
      return /^\d{4}-\d{2}-\d{2}/.test(s)
    }
    expect(isValidDate('2024-03-15')).toBe(true)
    expect(isValidDate('2024-03-15T10:00:00')).toBe(true)
    expect(isValidDate(null)).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})
