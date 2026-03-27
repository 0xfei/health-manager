import { useEffect, useState, useCallback } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Select, Space, Tag, Typography, Tabs, message, Popconfirm, DatePicker, Row, Col,
} from 'antd'
import { PlusOutlined, DeleteOutlined, LineChartOutlined, TableOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  fetchDefinitions, fetchRecords, createRecord, deleteRecord,
  fetchChartData, createDefinition,
} from '../../api'
import type { IndicatorDefinition, IndicatorRecord, IndicatorChartData } from '../../types'
import IndicatorChart from '../../components/IndicatorChart'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const categories = ['血常规', '尿常规', '免疫', '炎症', '肾功能', '肝功能', '凝血/APS', '生化全项', '其他']

function statusColor(r: IndicatorRecord) {
  const v = r.value
  if (v == null) return undefined
  if (r.warn_low != null && v < r.warn_low) return '#ff4d4f'
  if (r.warn_high != null && v > r.warn_high) return '#ff4d4f'
  if (r.ref_min != null && v < r.ref_min) return '#faad14'
  if (r.ref_max != null && v > r.ref_max) return '#faad14'
  return '#52c41a'
}

export default function Indicators() {
  const { printRef, handlePrint } = usePrint({ title: '检验指标' })
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>([])
  const [records, setRecords] = useState<IndicatorRecord[]>([])
  const [chartData, setChartData] = useState<IndicatorChartData[]>([])
  const [selectedDef, setSelectedDef] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('table')
  const [addRecordModal, setAddRecordModal] = useState(false)
  const [addDefModal, setAddDefModal] = useState(false)
  const [form] = Form.useForm()
  const [defForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  // 日期范围筛选
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  // 分类筛选
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const loadDefinitions = useCallback(async () => {
    const defs = await fetchDefinitions()
    setDefinitions(defs)
    if (!selectedDef && defs.length > 0) setSelectedDef(defs[0].id)
  }, [selectedDef])

  const loadRecords = useCallback(async () => {
    const params: { indicator_id?: string; start_date?: string; end_date?: string } = {}
    if (selectedDef) params.indicator_id = selectedDef
    if (dateRange?.[0]) params.start_date = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) params.end_date = dateRange[1].format('YYYY-MM-DD')
    const recs = await fetchRecords(Object.keys(params).length ? params : undefined)
    setRecords(recs)
  }, [selectedDef, dateRange])

  const loadChart = useCallback(async () => {
    if (!selectedDef) return
    const data = await fetchChartData({ indicator_ids: selectedDef })
    setChartData(data)
  }, [selectedDef])

  // 首次加载所有指标的最新记录，用于过滤左侧列表
  const [allRecords, setAllRecords] = useState<IndicatorRecord[]>([])
  const loadAllRecords = useCallback(async () => {
    const recs = await fetchRecords()
    setAllRecords(recs)
  }, [])

  useEffect(() => { loadDefinitions(); loadAllRecords() }, [])
  useEffect(() => {
    if (selectedDef) { loadRecords(); loadChart() }
  }, [selectedDef, dateRange])

  const selectedDefinition = definitions.find(d => d.id === selectedDef)

  async function handleAddRecord(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      await createRecord({
        indicator_id: selectedDef!,
        value: vals.value as number | undefined,
        value_text: vals.value_text as string | undefined,
        recorded_at: (vals.recorded_at as dayjs.Dayjs).format('YYYY-MM-DD'),
        note: vals.note as string | undefined,
      })
      message.success('记录已添加')
      setAddRecordModal(false)
      form.resetFields()
      loadRecords(); loadChart()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  async function handleDeleteRecord(id: string) {
    await deleteRecord(id)
    message.success('已删除')
    loadRecords(); loadChart()
  }

  async function handleAddDef(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      await createDefinition(vals as Partial<IndicatorDefinition>)
      message.success('指标已添加')
      setAddDefModal(false)
      defForm.resetFields()
      loadDefinitions()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  // 只展示有记录的指标（hasRecord 由 records 结构间接判断，这里用 API 的 chart data 辅助）
  // 直接通过 definitions 是否在 records 中出现过来判断
  const defsWithData = new Set(
    allRecords.map(r => r.indicator_id).filter(Boolean)
  )

  // group definitions by category（只展示有数据的指标，并按分类筛选）
  const defsToShow = definitions.filter(d =>
    (defsWithData.has(d.id) || d.id === selectedDef) &&
    (!categoryFilter || d.category === categoryFilter)
  )
  const grouped = defsToShow.reduce<Record<string, IndicatorDefinition[]>>((acc, d) => {
    const cat = d.category ?? '其他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  const recordColumns = [
    {
      title: '检测日期', dataIndex: 'recorded_at', key: 'date', width: 110,
      sorter: (a: IndicatorRecord, b: IndicatorRecord) => a.recorded_at.localeCompare(b.recorded_at),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '数值', key: 'value', width: 120,
      render: (_: unknown, r: IndicatorRecord) => (
        <Text strong style={{ color: statusColor(r) ?? '#1a1a2e' }}>
          {r.value != null ? r.value : r.value_text ?? '—'}
          {r.value != null && r.unit && <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{r.unit}</Text>}
        </Text>
      ),
    },
    {
      title: '参考范围', key: 'ref', width: 140,
      render: (_: unknown, r: IndicatorRecord) => {
        if (r.ref_min != null && r.ref_max != null) return <Text type="secondary" style={{ fontSize: 12 }}>{r.ref_min} – {r.ref_max}</Text>
        if (r.ref_max != null) return <Text type="secondary" style={{ fontSize: 12 }}>{'< '}{r.ref_max}</Text>
        return <Text type="secondary">—</Text>
      },
    },
    { title: '来源', dataIndex: 'source_type', key: 'source', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: IndicatorRecord) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDeleteRecord(r.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>检验指标</Title>
        <Space>
          <RangePicker
            size="small"
            placeholder={['开始日期', '结束日期']}
            style={{ width: 220 }}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button icon={<PlusOutlined />} onClick={() => setAddDefModal(true)}>新增指标</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddRecordModal(true)} disabled={!selectedDef}>
            添加记录
          </Button>
        </Space>
      </div>

      <div ref={printRef}>
      <Row gutter={16}>
        {/* Left: indicator selector */}
        <Col span={5}>
          <Card size="small" title={
            <Space>
              <span>指标列表</span>
              <Select
                size="small"
                placeholder="分类"
                allowClear
                style={{ width: 80, fontSize: 12 }}
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categories.map(c => ({ value: c, label: c }))}
              />
            </Space>
          } style={{ height: '100%' }}>
            {Object.entries(grouped).map(([cat, defs]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</Text>
                <div style={{ marginTop: 4 }}>
                  {defs.map(d => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDef(d.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: selectedDef === d.id ? '#e8f0fe' : 'transparent',
                        color: selectedDef === d.id ? '#3b6cbf' : '#374151',
                        fontWeight: selectedDef === d.id ? 600 : 400,
                        fontSize: 13,
                        marginBottom: 2,
                        transition: 'background 0.15s',
                      }}
                    >
                      {d.name}
                      {!d.is_system && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>自定义</Tag>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </Col>

        {/* Right: records + chart */}
        <Col span={19}>
          {selectedDefinition && (
            <Card
              size="small"
              title={
                <Space>
                  <Text strong style={{ fontSize: 15 }}>{selectedDefinition.name}</Text>
                  <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{selectedDefinition.code}</Text>
                  {selectedDefinition.unit && <Tag>{selectedDefinition.unit}</Tag>}
                  {selectedDefinition.ref_min != null && selectedDefinition.ref_max != null && (
                    <Text type="secondary" style={{ fontSize: 12 }}>参考范围：{selectedDefinition.ref_min} – {selectedDefinition.ref_max}</Text>
                  )}
                </Space>
              }
              tabList={[
                { key: 'table', tab: <Space><TableOutlined />记录表</Space> },
                { key: 'chart', tab: <Space><LineChartOutlined />趋势图</Space> },
              ]}
              activeTabKey={activeTab}
              onTabChange={setActiveTab}
            >
              {activeTab === 'table' ? (
                <Table
                  dataSource={records}
                  columns={recordColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 15, size: 'small' }}
                  locale={{ emptyText: '暂无记录，点击右上角"添加记录"' }}
                />
              ) : (
                chartData.length > 0 && chartData[0].data.length > 0 ? (
                  <IndicatorChart data={chartData[0]} height={340} />
                ) : (
                  <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>暂无数据</div>
                )
              )}
            </Card>
          )}
        </Col>
      </Row>

      {/* Add Record Modal */}
      <Modal
        title={`添加记录 · ${selectedDefinition?.name ?? ''}`}
        open={addRecordModal}
        onCancel={() => { setAddRecordModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddRecord} style={{ marginTop: 16 }}>
          <Form.Item label="检测日期" name="recorded_at" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          {selectedDefinition?.unit ? (
            <Form.Item label={`数值 (${selectedDefinition.unit})`} name="value">
              <InputNumber style={{ width: '100%' }} placeholder="输入数值" />
            </Form.Item>
          ) : (
            <Form.Item label="结果" name="value_text">
              <Input placeholder="如：阴性、阳性、弱阳性" />
            </Form.Item>
          )}
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Definition Modal */}
      <Modal
        title="新增自定义指标"
        open={addDefModal}
        onCancel={() => { setAddDefModal(false); defForm.resetFields() }}
        onOk={() => defForm.submit()}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={defForm} layout="vertical" onFinish={handleAddDef} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="指标名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="如：血糖" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="英文代码" name="code" rules={[{ required: true }]}>
                <Input placeholder="如：GLU" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="单位" name="unit"><Input placeholder="mmol/L" /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="正常下限" name="ref_min"><InputNumber style={{ width: '100%' }} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="正常上限" name="ref_max"><InputNumber style={{ width: '100%' }} /></Form.Item>
            </Col>
          </Row>
          <Form.Item label="分类" name="category">
            <Select placeholder="选择分类">
              {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </div>
  )
}
