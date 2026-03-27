import api from './client'
import type {
  IndicatorDefinition, IndicatorRecord, IndicatorChartData,
  DashboardSummary, SymptomRecord, MedicationRecord,
  INRDoseLog, INRTimelinePoint, VisitRecord, AnalysisResult,
} from '../types'

// ── Dashboard ──────────────────────────────────────────────────
export const fetchDashboard = (): Promise<DashboardSummary> =>
  api.get('/dashboard/summary').then(r => r.data)

// ── Patient Profile ────────────────────────────────────────────
export const fetchProfile = (): Promise<Record<string, unknown>> =>
  api.get('/profile').then(r => r.data)

export const upsertProfile = (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
  api.put('/profile', data).then(r => r.data)

export const generateAISummary = (): Promise<{ ai_summary: string; ok: boolean }> =>
  api.post('/profile/ai-summary').then(r => r.data)

// ── Indicators ─────────────────────────────────────────────────
export const fetchDefinitions = (): Promise<IndicatorDefinition[]> =>
  api.get('/indicators/definitions').then(r => r.data)

export const createDefinition = (data: Partial<IndicatorDefinition>): Promise<IndicatorDefinition> =>
  api.post('/indicators/definitions', data).then(r => r.data)

export const updateDefinition = (id: string, data: Partial<IndicatorDefinition>): Promise<IndicatorDefinition> =>
  api.put(`/indicators/definitions/${id}`, data).then(r => r.data)

export const deleteDefinition = (id: string): Promise<void> =>
  api.delete(`/indicators/definitions/${id}`).then(r => r.data)

export const fetchRecords = (params?: {
  indicator_id?: string
  start_date?: string
  end_date?: string
}): Promise<IndicatorRecord[]> =>
  api.get('/indicators/records', { params }).then(r => r.data)

export const createRecord = (data: {
  indicator_id: string
  value?: number
  value_text?: string
  recorded_at: string
  source_type?: string
  note?: string
}): Promise<IndicatorRecord> =>
  api.post('/indicators/records', data).then(r => r.data)

export const deleteRecord = (id: string): Promise<void> =>
  api.delete(`/indicators/records/${id}`).then(r => r.data)

export const fetchChartData = (params?: {
  indicator_ids?: string
  start_date?: string
  end_date?: string
}): Promise<IndicatorChartData[]> =>
  api.get('/indicators/records/chart-data', { params }).then(r => r.data)

// ── Symptoms ───────────────────────────────────────────────────
export const fetchSymptoms = (params?: { start_date?: string; end_date?: string }): Promise<SymptomRecord[]> =>
  api.get('/symptoms/records', { params }).then(r => r.data)

export const createSymptom = (data: {
  recorded_at: string
  raw_text: string
  severity?: number
}): Promise<SymptomRecord> =>
  api.post('/symptoms/records', data).then(r => r.data)

export const deleteSymptom = (id: string): Promise<void> =>
  api.delete(`/symptoms/records/${id}`).then(r => r.data)

// ── Medications ────────────────────────────────────────────────
export const fetchMedications = (params?: { is_aps_related?: boolean }): Promise<MedicationRecord[]> =>
  api.get('/medications', { params }).then(r => r.data)

export const createMedication = (data: Partial<MedicationRecord>): Promise<MedicationRecord> =>
  api.post('/medications', data).then(r => r.data)

export const updateMedication = (id: string, data: Partial<MedicationRecord>): Promise<MedicationRecord> =>
  api.put(`/medications/${id}`, data).then(r => r.data)

export const deleteMedication = (id: string): Promise<void> =>
  api.delete(`/medications/${id}`).then(r => r.data)

// ── APS / INR ──────────────────────────────────────────────────
export const fetchINRTimeline = (): Promise<INRTimelinePoint[]> =>
  api.get('/aps/inr-timeline').then(r => r.data)

export const fetchINRLatest = (): Promise<INRDoseLog | null> =>
  api.get('/aps/inr-latest').then(r => r.data)

export const fetchINRLogs = (): Promise<INRDoseLog[]> =>
  api.get('/aps/inr-dose-logs').then(r => r.data)

export const createINRLog = (data: {
  log_date: string
  inr_value?: number
  warfarin_dose?: number
  note?: string
  next_test_date?: string
}): Promise<INRDoseLog> =>
  api.post('/aps/inr-dose-log', data).then(r => r.data)

export const deleteINRLog = (id: string): Promise<void> =>
  api.delete(`/aps/inr-dose-log/${id}`).then(r => r.data)

// ── Visits ─────────────────────────────────────────────────────
export const fetchVisits = (): Promise<VisitRecord[]> =>
  api.get('/visits').then(r => r.data)

export const createVisit = (data: Partial<VisitRecord>): Promise<VisitRecord> =>
  api.post('/visits', data).then(r => r.data)

export const deleteVisit = (id: string): Promise<void> =>
  api.delete(`/visits/${id}`).then(r => r.data)

// ── Upload ─────────────────────────────────────────────────────
export const uploadFile = (file: File): Promise<{ id: string; file_name: string; status: string; file_type: string }> => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload/file', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const analyzeUpload = (uploadId: string): Promise<{
  id: string; status: string; ai_parsed_json: Record<string, unknown> | null; error_msg: string | null
}> =>
  api.post(`/upload/analyze/${uploadId}`).then(r => r.data)

export const confirmUpload = (uploadId: string, items?: Record<string, unknown>[]): Promise<{
  imported: number; skipped: string[]; auto_created: string[]; message: string
}> =>
  api.post(`/upload/confirm/${uploadId}`, items ?? null).then(r => r.data)

export const fetchUploadRecords = (): Promise<unknown[]> =>
  api.get('/upload/records').then(r => r.data)

export const deleteUpload = (id: string): Promise<void> =>
  api.delete(`/upload/${id}`).then(r => r.data)

// ── Analysis / Change Events ───────────────────────────────────
export const fetchAnalysis = (days = 90): Promise<AnalysisResult> =>
  api.get('/analysis/changes', { params: { days } }).then(r => r.data)

// ── Config ─────────────────────────────────────────────────────
export const fetchFullConfig = (): Promise<Record<string, unknown>> =>
  api.get('/config/full').then(r => r.data)

export const updateConfig = (payload: Record<string, unknown>): Promise<{
  ok: boolean; message: string; parse: Record<string, unknown>
}> =>
  api.post('/config/update', payload).then(r => r.data)

export const reloadConfig = (): Promise<{ ok: boolean; message: string }> =>
  api.post('/config/reload').then(r => r.data)
