import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  DatePicker, Space, Typography, Tag, Popconfirm, message, Rate,
} from 'antd'
import { PlusOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchSymptoms, createSymptom, deleteSymptom } from '../../api'
import type { SymptomRecord, ParsedSymptom } from '../../types'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text, Paragraph } = Typography

const severityDesc = ['', '轻微', '较轻', '一般', '较重', '严重', '严重', '很严重', '很严重', '极重', '极重']

const categoryColors: Record<string, string> = {
  '皮肤': 'magenta',
  '关节': 'orange',
  '肾脏': 'blue',
  '神经系统': 'purple',
  '心肺': 'red',
  '血栓': 'volcano',
  '其他': 'default',
}

export default function Symptoms() {
  const [records, setRecords] = useState<SymptomRecord[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

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

  const columns = [
    {
      title: '日期', dataIndex: 'recorded_at', key: 'date', width: 100,
      sorter: (a: SymptomRecord, b: SymptomRecord) => a.recorded_at.localeCompare(b.recorded_at),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '严重程度', dataIndex: 'severity', key: 'severity', width: 140,
      render: (v: number | null) => v != null ? (
        <Space>
          <Rate disabled value={Math.ceil(v / 2)} count={5} style={{ fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>{severityDesc[v] ?? ''}</Text>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: '症状描述', dataIndex: 'raw_text', key: 'text',
      render: (v: string | null) => <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, fontSize: 13 }}>{v ?? '—'}</Paragraph>,
    },
    {
      title: 'AI 摘要', dataIndex: 'ai_summary', key: 'summary',
      render: (v: string | null) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '解析症状', dataIndex: 'parsed_symptoms', key: 'parsed',
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
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: SymptomRecord) => (
        <Popconfirm title="确认删除？" onConfirm={async () => { await deleteSymptom(r.id); load() }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  const { printRef, handlePrint } = usePrint({ title: '症状记录' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>症状记录</Title>
        <Space>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>记录症状</Button>
        </Space>
      </div>

      <div ref={printRef}>
      <Card size="small">
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 15, size: 'small' }}
          locale={{ emptyText: '暂无症状记录' }}
        />
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
              placeholder="例如：今天早晨起床关节有些僵硬，双膝关节疼痛，下午出现轻微头痛，脸上红斑颜色加深..."
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
