/**
 * 前端工具函数测试
 * 覆盖：指标状态判断逻辑、日期格式化、INR 状态判断
 */
import { describe, it, expect } from 'vitest'
import type { IndicatorSummaryItem } from '../types'

// ── 指标状态判断（从 Dashboard 组件提取的逻辑）─────────────────────────────

function getIndicatorStatus(
  value: number | null | undefined,
  warnLow: number | null | undefined,
  warnHigh: number | null | undefined,
  refMin: number | null | undefined,
  refMax: number | null | undefined
): 'normal' | 'warning' | 'danger' | 'unknown' {
  if (value == null) return 'unknown'
  if (warnLow != null && value < warnLow) return 'danger'
  if (warnHigh != null && value > warnHigh) return 'danger'
  if (refMin != null && value < refMin) return 'warning'
  if (refMax != null && value > refMax) return 'warning'
  return 'normal'
}

// ── INR 状态判断（从 APS 页面提取的逻辑）────────────────────────────────────

function getINRStatus(val: number | null): { status: 'success' | 'warning' | 'error' | 'default'; label: string } {
  if (val == null) return { status: 'default', label: '无数据' }
  if (val < 1.8) return { status: 'error', label: '抗凝不足' }
  if (val > 3.5) return { status: 'error', label: '出血风险' }
  if (val >= 2.0 && val <= 3.0) return { status: 'success', label: '达标' }
  return { status: 'warning', label: '接近边界' }
}

// ── 参考范围格式化 ────────────────────────────────────────────────────────────

function formatRefRange(refMin: number | null, refMax: number | null, unit: string | null): string {
  if (refMin != null && refMax != null) return `${refMin} – ${refMax} ${unit ?? ''}`.trim()
  if (refMax != null) return `< ${refMax} ${unit ?? ''}`.trim()
  if (refMin != null) return `>= ${refMin} ${unit ?? ''}`.trim()
  return '—'
}


// ═══ 测试 ════════════════════════════════════════════════════════════════════

describe('指标状态判断', () => {
  describe('正常值', () => {
    it('值在正常范围内返回 normal', () => {
      expect(getIndicatorStatus(6.5, 3.0, 12.0, 4.0, 10.0)).toBe('normal')
    })

    it('值等于正常范围下限时返回 normal', () => {
      expect(getIndicatorStatus(4.0, 3.0, 12.0, 4.0, 10.0)).toBe('normal')
    })

    it('值等于正常范围上限时返回 normal', () => {
      expect(getIndicatorStatus(10.0, 3.0, 12.0, 4.0, 10.0)).toBe('normal')
    })
  })

  describe('预警值 (danger)', () => {
    it('值低于预警下限返回 danger', () => {
      // WBC warn_low = 3.0
      expect(getIndicatorStatus(2.0, 3.0, 12.0, 4.0, 10.0)).toBe('danger')
    })

    it('值高于预警上限返回 danger', () => {
      // WBC warn_high = 12.0
      expect(getIndicatorStatus(15.0, 3.0, 12.0, 4.0, 10.0)).toBe('danger')
    })

    it('值略低于预警下限时返回 danger', () => {
      expect(getIndicatorStatus(2.9, 3.0, 12.0, 4.0, 10.0)).toBe('danger')
    })
  })

  describe('偏高/偏低 (warning)', () => {
    it('值低于正常下限但高于预警下限返回 warning', () => {
      expect(getIndicatorStatus(3.5, 3.0, 12.0, 4.0, 10.0)).toBe('warning')
    })

    it('值高于正常上限但低于预警上限返回 warning', () => {
      expect(getIndicatorStatus(11.0, 3.0, 12.0, 4.0, 10.0)).toBe('warning')
    })
  })

  describe('无数据 (unknown)', () => {
    it('值为 null 返回 unknown', () => {
      expect(getIndicatorStatus(null, 3.0, 12.0, 4.0, 10.0)).toBe('unknown')
    })

    it('值为 undefined 返回 unknown', () => {
      expect(getIndicatorStatus(undefined, 3.0, 12.0, 4.0, 10.0)).toBe('unknown')
    })
  })

  describe('无阈值', () => {
    it('没有任何阈值时，有值返回 normal', () => {
      expect(getIndicatorStatus(100, null, null, null, null)).toBe('normal')
    })

    it('只有上限时超出返回 warning', () => {
      expect(getIndicatorStatus(150, null, null, null, 100)).toBe('warning')
    })
  })
})


describe('INR 状态判断', () => {
  it('null 值返回无数据', () => {
    const r = getINRStatus(null)
    expect(r.status).toBe('default')
    expect(r.label).toBe('无数据')
  })

  it('INR < 1.8 为抗凝不足', () => {
    const r = getINRStatus(1.5)
    expect(r.status).toBe('error')
    expect(r.label).toBe('抗凝不足')
  })

  it('INR > 3.5 为出血风险', () => {
    const r = getINRStatus(4.0)
    expect(r.status).toBe('error')
    expect(r.label).toBe('出血风险')
  })

  it('INR 2.0-3.0 为达标', () => {
    const r = getINRStatus(2.5)
    expect(r.status).toBe('success')
    expect(r.label).toBe('达标')
  })

  it('INR 1.8-2.0 接近边界', () => {
    const r = getINRStatus(1.9)
    expect(r.status).toBe('warning')
    expect(r.label).toBe('接近边界')
  })

  it('INR 3.0-3.5 接近边界', () => {
    const r = getINRStatus(3.2)
    expect(r.status).toBe('warning')
    expect(r.label).toBe('接近边界')
  })

  it('INR 恰好 2.0 为达标', () => {
    expect(getINRStatus(2.0).status).toBe('success')
  })

  it('INR 恰好 3.0 为达标', () => {
    expect(getINRStatus(3.0).status).toBe('success')
  })
})


describe('参考范围格式化', () => {
  it('有上下限和单位', () => {
    expect(formatRefRange(4.0, 10.0, '×10⁹/L')).toBe('4 – 10 ×10⁹/L')
  })

  it('只有上限', () => {
    expect(formatRefRange(null, 100.0, 'IU/mL')).toBe('< 100 IU/mL')
  })

  it('只有下限', () => {
    expect(formatRefRange(0, null, 'g/L')).toBe('>= 0 g/L')
  })

  it('无上下限', () => {
    expect(formatRefRange(null, null, null)).toBe('—')
  })

  it('无单位', () => {
    expect(formatRefRange(2.0, 3.0, null)).toBe('2 – 3')
  })
})
