import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  DatePicker, Space, Typography, Tag, Popconfirm, message, Rate, Tabs, Select,
} from 'antd'
import { PlusOutlined, DeleteOutlined, PrinterOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchSymptoms, createSymptom, deleteSymptom } from '../../api'
import type { SymptomRecord, ParsedSymptom } from '../../types'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text, Paragraph } = Typography

const severityDesc = ['', '轻微', '较轻', '一般', '较重', '严重', '严重', '很严重', '很严重', '极重', '极重']

// ── 分类配置 ──────────────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { key: 'all',   label: '全部',       color: 'default' },
  { key: '眼科',  label: '👁 眼睛',    color: 'blue' },
  { key: '神经',  label: '🧠 神经',    color: 'purple' },
  { key: '关节',  label: '🦴 关节/肌肉', color: 'orange' },
  { key: '消化',  label: '🫃 消化',    color: 'green' },
  { key: '血液/心血管', label: '❤ 心血管', color: 'red' },
  { key: '其他',  label: '其他',       color: 'default' },
]

const categoryColors: Record<string, string> = {
  '眼科': 'blue',
  '神经': 'purple',
  '关节': 'orange',
  '消化': 'green',
  '血液/心血管': 'red',
  '其他': 'default',
}

// ── 从 parsed_symptoms 提取主分类 ─────────────────────────────────────────────
function getMainCategory(record: SymptomRecord): string {
  const syms = record.parsed_symptoms
  if (!syms || syms.length === 0) return '其他'
  // 取第一个有分类的症状
  const first = syms.find(s => s.category && s.category !== '其他')
  return first?.category ?? syms[0]?.category ?? '其他'
}

export default function Symptoms() {
  const [records, setRecords] = useState<SymptomRecord[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [activeCategory, setActiveCategory] = useState('all')
  const [yearFilter, setYearFilter] = useState<string>('all')

  const load = async () => {
    const data = await fetchSymptoms()
    setRecords(data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      await createSymptom({
        recorded_at: (vals.recorded_at as dayjs.Dayjs).format('YYYY-MM-DD'),
        raw_text: vals.raw_text as string,
        severity: vals.severity as number | undefined,
      })
      message.success('症状记录已保存')
      setModal(false)
      form.resetFields()
      load()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  // ── 过滤逻辑 ────────────────────────────────────────────────────────────────
  const years = ['all', ...Array.from(
    new Set(records.map(r => r.recorded_at.slice(0, 4)))
  ).sort().reverse()]

  const filtered = records.filter(r => {
    if (yearFilter !== 'all' && !r.recorded_at.startsWith(yearFilter)) return false
    if (activeCategory === 'all') return true
    return getMainCategory(r) === activeCategory
  })

  // ── 各分类数量统计 ──────────────────────────────────────────────────────────
  const catCount = (cat: string) => {
    if (cat === 'all') return records.filter(r =>
      yearFilter === 'all' || r.recorded_at.startsWith(yearFilter)
    ).length
    return records.filter(r => {
      if (yearFilter !== 'all' && !r.recorded_at.startsWith(yearFilter)) return false
      return getMainCategory(r) === cat
    }).length
  }

  const columns = [
    {
      title: '日期', dataIndex: 'recorded_at', key: 'date', width: 100,
      sorter: (a: SymptomRecord, b: SymptomRecord) => a.recorded_at.localeCompare(b.recorded_at),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '分类', key: 'category', width: 80,
      render: (_: unknown, r: SymptomRecord) => {
        const cat = getMainCategory(r)
        return <Tag color={categoryColors[cat] ?? 'default'} style={{ fontSize: 11 }}>{cat}</Tag>
      },
    },
    {
      title: '症状描述', dataIndex: 'raw_text', key: 'text',
      render: (v: string | null) => (
        <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, fontSize: 13 }}>
          {v ?? '—'}
        </Paragraph>
      ),
    },
    {
      title: '解析症状', dataIndex: 'parsed_symptoms', key: 'parsed', width: 200,
      render: (v: ParsedSymptom[] | null) => v?.length ? (
        <Space wrap size={4}>
          {v.map((s, i) => (
            <Tag key={i} color={categoryColors[s.category] ?? 'default'} style={{ fontSize: 11 }}>
              {s.symptom_name}
            </Tag>
          ))}
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: '严重程度', dataIndex: 'severity', key: 'severity', width: 120,
      render: (v: number | null) => v != null ? (
        <Space>
          <Rate disabled value={Math.ceil(v / 2)} count={5} style={{ fontSize: 11 }} />
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: SymptomRecord) => (
        <Popconfirm title="确认删除？" onConfirm={async () => { await deleteSymptom(r.id); load() }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  const { printRef, handlePrint } = usePrint({ title: '症状记录' })

  const tabItems = CATEGORY_TABS.map(tab => ({
    key: tab.key,
    label: (
      <span>
        {tab.label}
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
          ({catCount(tab.key)})
        </Text>
      </span>
    ),
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>症状记录</Title>
        <Space>
          <Select
            value={yearFilter}
            onChange={setYearFilter}
            size="small"
            style={{ width: 90 }}
            prefix={<FilterOutlined />}
          >
            {years.map(y => (
              <Select.Option key={y} value={y}>{y === 'all' ? '全部年份' : y + '年'}</Select.Option>
            ))}
          </Select>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>记录症状</Button>
        </Space>
      </div>

      <div ref={printRef}>
        <Card size="small" bodyStyle={{ padding: 0 }}>
          {/* 分类 Tab */}
          <div style={{ padding: '0 16px', borderBottom: '1px solid #f0f0f0' }}>
            <Tabs
              activeKey={activeCategory}
              onChange={setActiveCategory}
              items={tabItems}
              size="small"
              tabBarStyle={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ padding: '12px 16px 16px' }}>
            <Table
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 20, size: 'small', showTotal: total => `共 ${total} 条` }}
              locale={{ emptyText: '该分类暂无症状记录' }}
            />
          </div>
        </Card>
      </div>

      <Modal
        title="记录今日症状"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd} style={{ marginTop: 16 }}>
          <Form.Item label="日期" name="recorded_at" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="症状描述（用自然语言描述，AI 将自动解析）"
            name="raw_text"
            rules={[{ required: true, message: '请输入症状描述' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="例如：左眼外下方有阴影，持续约10分钟后消失，无明显头痛..."
            />
          </Form.Item>
          <Form.Item label="主观严重程度 (1-10)" name="severity">
            <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="1=轻微，10=极重" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
