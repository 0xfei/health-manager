// API types matching backend schemas
export interface IndicatorDefinition {
  id: string
  name: string
  code: string
  unit: string | null
  ref_min: number | null
  ref_max: number | null
  warn_low: number | null
  warn_high: number | null
  category: string | null
  description: string | null
  is_system: boolean
  sort_order: number
  created_at: string
}

export interface IndicatorRecord {
  id: string
  indicator_id: string
  value: number | null
  value_text: string | null
  recorded_at: string
  source_type: string
  note: string | null
  created_at: string
  // enriched
  indicator_name?: string
  indicator_code?: string
  unit?: string | null
  ref_min?: number | null
  ref_max?: number | null
  warn_low?: number | null
  warn_high?: number | null
}

export interface ChartDataPoint {
  date: string
  value: number | null
  value_text: string | null
}

export interface IndicatorChartData {
  indicator_id: string
  indicator_name: string
  indicator_code: string
  unit: string | null
  ref_min: number | null
  ref_max: number | null
  warn_low: number | null
  warn_high: number | null
  data: ChartDataPoint[]
}

export interface SymptomRecord {
  id: string
  recorded_at: string
  raw_text: string | null
  parsed_symptoms: ParsedSymptom[] | null
  severity: number | null
  ai_summary: string | null
  created_at: string
}

export interface ParsedSymptom {
  symptom_name: string
  category: string
  severity: number | null
  duration: string | null
}

export interface MedicationRecord {
  id: string
  drug_name: string
  dosage: string | null
  dosage_value: number | null
  dosage_unit: string | null
  frequency: string | null
  start_date: string | null
  end_date: string | null
  category: string | null
  is_aps_related: boolean
  note: string | null
  created_at: string
}

export interface INRDoseLog {
  id: string
  log_date: string
  inr_value: number | null
  warfarin_dose: number | null
  note: string | null
  next_test_date: string | null
  created_at: string
}

export interface INRTimelinePoint {
  date: string
  inr_value: number | null
  warfarin_dose: number | null
  note: string | null
  next_test_date: string | null
}

export interface VisitRecord {
  id: string
  visit_date: string
  hospital: string | null
  doctor: string | null
  diagnosis: string | null
  advice: string | null
  attachments: unknown[] | null
  created_at: string
}

export interface IndicatorSummaryItem {
  indicator_id: string
  indicator_name: string
  indicator_code: string
  unit: string | null
  latest_value: number | null
  latest_value_text: string | null
  latest_date: string | null
  ref_min: number | null
  ref_max: number | null
  warn_low: number | null
  warn_high: number | null
  status: 'normal' | 'warning' | 'danger' | 'unknown'
}

export interface DashboardSummary {
  total_records: number
  last_update: string | null
  indicators: IndicatorSummaryItem[]
  inr_latest: INRDoseLog | null
  upcoming_tests: string[]
}

export type IndicatorStatus = 'normal' | 'warning' | 'danger' | 'unknown'
