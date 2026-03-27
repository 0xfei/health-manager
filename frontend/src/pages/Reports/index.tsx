/**
 * 检查报告汇总页
 * 按上传批次展示所有 AI 解析结果，支持日期范围筛选和报告类别筛选
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Card, Table, Typography, Tag, Space, Badge, DatePicker,
  Row, Col, Select, Button, Collapse, Alert, Divider,
  Tooltip, Empty,
} from 'antd'
import {
  CalendarOutlined, BankOutlined, FileOutlined,
  FileImageOutlined, FilePdfOutlined, FileExcelOutlined,
  FileWordOutlined, ReloadOutlined, PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchUploadRecords } from '../../api'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Panel } = Collapse

// ── 类型定义 ──────────────────────────────────────────────────────────────────

interface ParsedIndicator {
  name: string
  code?: string
  value?: number | null
  value_text?: string | null
  unit?: string | null
  ref_range?: string | null
  recorded_at?: string | null
}

interface ParsedResult {
  report_date?: string | null
  hospital?: string | null
  report_category?: string | null
  confidence?: number
  indicators?: ParsedIndicator[]
}

interface UploadRecord {
  id: string
  file_name: string
  file_type: string
  status: string
  error_msg?: string
  ai_parsed_json?: ParsedResult | null
  created_at: string
}

// ── 工具 ──────────────────────────────────────────────────────────────────────

function FileIcon({ type }: { type: string }) {
  const style = { marginRight: 4 }
  if (type === 'image') return <FileImageOutlined style={{ ...style, color: '#3b6cbf' }} />
  if (type === 'pdf') return <FilePdfOutlined style={{ ...style, color: '#ff4d4f' }} />
  if (type === 'excel') return <FileExcelOutlined style={{ ...style, color: '#52c41a' }} />
  if (type === 'doc') return <FileWordOutlined style={{ ...style, color: '#1677ff' }} />
  return <FileOutlined style={{ ...style, color: '#9ca3af' }} />
}

const CATEGORY_COLORS: Record<string, string> = {
  '血常规': 'red',
  '尿常规': 'blue',
  '生化全项': 'orange',
  '免疫全项': 'purple',
  '凝血功能': 'volcano',
  '24h尿蛋白': 'cyan',
  '肝肾功能': 'lime',
  '甲状腺功能': 'geekblue',
  '血糖血脂': 'gold',
  '肿瘤标志物': 'magenta',
  '其他': 'default',
}

function categoryColor(cat?: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? 'default'
}

// ── 指标行内展示 ──────────────────────────────────────────────────────────────

function IndicatorRow({ item }: { item: ParsedIndicator }) {
  const hasValue = item.value != null
  const hasText = item.value_text != null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
      borderBottom: '1px solid #f0f0f0', fontSize: 13,
    }}>
      <Space size={8}>
        <Text strong style={{ minWidth: 100, display: 'inline-block' }}>{item.name}</Text>
        {item.code && <Text type="secondary" style={{ fontSize: 11 }}>{item.code}</Text>}
      </Space>
      <Space size={16}>
        <Text style={{ minWidth: 80, textAlign: 'right', display: 'inline-block' }}>
          {hasValue
            ? <><span style={{ fontWeight: 600 }}>{item.value}</span>{item.unit && <Text type="secondary" style={{ fontSize: 11, marginLeft: 2 }}>{item.unit}</Text>}</>
            : hasText
              ? <Text type="secondary">{item.value_text}</Text>
              : <Text type="secondary">—</Text>
          }
        </Text>
        {item.ref_range && (
          <Text type="secondary" style={{ fontSize: 11, minWidth: 80 }}>参考: {item.ref_range}</Text>
        )}
      </Space>
    </div>
  )
}

// ── 单张报告卡片 ──────────────────────────────────────────────────────────────

function ReportCard({ record }: { record: UploadRecord }) {
  const parsed = record.ai_parsed_json
  const indicators = parsed?.indicators ?? []
  const category = parsed?.report_category

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Space size={8} wrap>
          <FileIcon type={record.file_type} />
          <Text strong style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.file_name}
          </Text>
          {category && <Tag color={categoryColor(category)}>{category}</Tag>}
          {record.status !== 'done' && (
            <Tag color={record.status === 'processing' ? 'processing' : 'default'}>
              {record.status === 'processing' ? '解析中' : record.status === 'failed' ? '解析失败' : '待解析'}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space size={8}>
          {parsed?.hospital && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <BankOutlined style={{ marginRight: 4 }} />{parsed.hospital}
            </Text>
          )}
          {parsed?.report_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />{parsed.report_date}
            </Text>
          )}
          <Text type="secondary" style={{ fontSize: 11 }}>
            上传于 {dayjs(record.created_at).format('MM-DD HH:mm')}
          </Text>
        </Space>
      }
    >
      {record.status === 'failed' && record.error_msg && (
        <Alert type="error" message={record.error_msg} showIcon style={{ marginBottom: 8 }} />
      )}
      {record.status === 'done' && indicators.length === 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>未解析到任何指标</Text>
      )}
      {indicators.length > 0 && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '4px 8px',
            background: '#f5f5f5', borderRadius: 4, marginBottom: 2, fontSize: 12, fontWeight: 600,
          }}>
            <span>指标名称</span>
            <span>检测值 / 参考范围</span>
          </div>
          {indicators.map((item, i) => (
            <IndicatorRow key={i} item={item} />
          ))}
          <div style={{ marginTop: 6, textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              共 {indicators.length} 项指标
              {parsed?.confidence != null && `，AI 置信度 ${Math.round(parsed.confidence * 100)}%`}
            </Text>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = ['血常规', '尿常规', '生化全项', '免疫全项', '凝血功能',
  '24h尿蛋白', '肝肾功能', '甲状腺功能', '血糖血脂', '肿瘤标志物', '其他']

export default function Reports() {
  const { printRef, handlePrint } = usePrint({ title: '检查报告汇总' })
  const [records, setRecords] = useState<UploadRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchUploadRecords() as UploadRecord[]
      setRecords(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 已完成解析的记录
  const doneRecords = records.filter(r => r.status === 'done' && r.ai_parsed_json)

  // 日期筛选
  const filteredByDate = doneRecords.filter(r => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return true
    const reportDate = r.ai_parsed_json?.report_date
    const uploadDate = dayjs(r.created_at).format('YYYY-MM-DD')
    const date = reportDate || uploadDate
    return dayjs(date).isAfter(dateRange[0].subtract(1, 'day')) &&
           dayjs(date).isBefore(dateRange[1].add(1, 'day'))
  })

  // 类别筛选
  const filtered = categoryFilter.length > 0
    ? filteredByDate.filter(r => {
        const cat = r.ai_parsed_json?.report_category ?? '其他'
        return categoryFilter.includes(cat)
      })
    : filteredByDate

  // 按类别分组统计（用于标签云）
  const categoryCounts = doneRecords.reduce<Record<string, number>>((acc, r) => {
    const cat = r.ai_parsed_json?.report_category ?? '其他'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {})

  const pendingCount = records.filter(r => r.status === 'pending' || r.status === 'processing').length
  const failedCount = records.filter(r => r.status === 'failed').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>检查报告汇总</Title>
        <Space>
          <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>刷新</Button>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
        </Space>
      </div>

      {/* 统计概览 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f0f4ff' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>已解析报告</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b6cbf' }}>{doneRecords.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>总指标项</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
              {doneRecords.reduce((sum, r) => sum + (r.ai_parsed_json?.indicators?.length ?? 0), 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: pendingCount > 0 ? '#fffbe6' : '#f5f5f5' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>待解析</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: pendingCount > 0 ? '#faad14' : '#9ca3af' }}>
              {pendingCount}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center', background: failedCount > 0 ? '#fff2f0' : '#f5f5f5' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>解析失败</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: failedCount > 0 ? '#ff4d4f' : '#9ca3af' }}>
              {failedCount}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 类别快捷筛选标签 */}
      {Object.keys(categoryCounts).length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size={8} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>快速筛选：</Text>
            <Tag
              style={{ cursor: 'pointer' }}
              color={categoryFilter.length === 0 ? 'blue' : 'default'}
              onClick={() => setCategoryFilter([])}
            >
              全部 ({doneRecords.length})
            </Tag>
            {Object.entries(categoryCounts).map(([cat, cnt]) => (
              <Tag
                key={cat}
                style={{ cursor: 'pointer' }}
                color={categoryFilter.includes(cat) ? categoryColor(cat) : 'default'}
                onClick={() => {
                  setCategoryFilter(prev =>
                    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                  )
                }}
              >
                {cat} ({cnt})
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* 筛选工具栏 */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Space>
            <CalendarOutlined style={{ color: '#9ca3af' }} />
            <RangePicker
              size="small"
              placeholder={['报告开始日期', '报告结束日期']}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              style={{ width: 280 }}
            />
          </Space>
        </Col>
        <Col span={12}>
          <Select
            mode="multiple"
            size="small"
            placeholder="按报告类别筛选"
            style={{ width: 300 }}
            options={ALL_CATEGORIES.map(c => ({ value: c, label: c }))}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
          />
        </Col>
      </Row>

      {/* 报告列表 */}
      <div ref={printRef}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            加载中...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <Empty
            description={
              doneRecords.length === 0
                ? '暂无解析完成的报告，请前往「上传解析」页面上传化验单'
                : '当前筛选条件下没有匹配的报告'
            }
            style={{ padding: '40px 0' }}
          />
        )}

        {!loading && filtered.map(record => (
          <ReportCard key={record.id} record={record} />
        ))}

        {filtered.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {filtered.length} 份报告，
            {filtered.reduce((sum, r) => sum + (r.ai_parsed_json?.indicators?.length ?? 0), 0)} 项指标
          </Text>
        )}
      </div>
    </div>
  )
}
