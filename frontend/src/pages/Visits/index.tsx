import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input,
  DatePicker, Space, Typography, Popconfirm, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchVisits, createVisit, deleteVisit } from '../../api'
import type { VisitRecord } from '../../types'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text, Paragraph } = Typography

export default function Visits() {
  const [records, setRecords] = useState<VisitRecord[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = async () => { setRecords(await fetchVisits()) }
  useEffect(() => { load() }, [])

  async function handleAdd(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      await createVisit({
        ...vals,
        visit_date: (vals.visit_date as dayjs.Dayjs).format('YYYY-MM-DD'),
      } as Partial<VisitRecord>)
      message.success('就诊记录已添加')
      setModal(false)
      form.resetFields()
      load()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const columns = [
    {
      title: '就诊日期', dataIndex: 'visit_date', key: 'date', width: 110,
      sorter: (a: VisitRecord, b: VisitRecord) => a.visit_date.localeCompare(b.visit_date),
      defaultSortOrder: 'descend' as const,
    },
    { title: '医院', dataIndex: 'hospital', key: 'hospital', width: 160 },
    { title: '医生', dataIndex: 'doctor', key: 'doctor', width: 100 },
    {
      title: '诊断', dataIndex: 'diagnosis', key: 'diagnosis',
      render: (v: string | null) => <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0 }}>{v ?? '—'}</Paragraph>,
    },
    {
      title: '医嘱', dataIndex: 'advice', key: 'advice',
      render: (v: string | null) => <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{v ?? '—'}</Paragraph>,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: VisitRecord) => (
        <Popconfirm title="确认删除？" onConfirm={async () => { await deleteVisit(r.id); load() }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  const { printRef, handlePrint } = usePrint({ title: '就诊记录' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>就诊记录</Title>
        <Space>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>添加就诊</Button>
        </Space>
      </div>

      <div ref={printRef}>
      <Card size="small">
        <Table dataSource={records} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 15 }} locale={{ emptyText: '暂无就诊记录' }} />
      </Card>
      </div>

      <Modal
        title="添加就诊记录"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd} style={{ marginTop: 16 }}>
          <Form.Item label="就诊日期" name="visit_date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="医院" name="hospital">
            <Input placeholder="如：北京协和医院" />
          </Form.Item>
          <Form.Item label="主诊医生" name="doctor">
            <Input placeholder="医生姓名" />
          </Form.Item>
          <Form.Item label="诊断结论" name="diagnosis">
            <Input.TextArea rows={3} placeholder="医生的诊断内容" />
          </Form.Item>
          <Form.Item label="医嘱/建议" name="advice">
            <Input.TextArea rows={3} placeholder="医生的用药建议、注意事项等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
