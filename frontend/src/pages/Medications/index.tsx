import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  DatePicker, Space, Typography, Tag, Popconfirm, message, Select, Switch, Row, Col,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchMedications, createMedication, updateMedication, deleteMedication } from '../../api'
import type { MedicationRecord } from '../../types'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text } = Typography
const { Option } = Select

const categoryLabels: Record<string, { text: string; color: string }> = {
  anticoagulant: { text: '抗凝药', color: 'volcano' },
  steroid: { text: '激素', color: 'orange' },
  immunosuppressant: { text: '免疫抑制剂', color: 'blue' },
  antimalarial: { text: '抗疟药', color: 'cyan' },
  antiplatelet: { text: '抗血小板', color: 'purple' },
  other: { text: '其他', color: 'default' },
}

export default function Medications() {
  const [records, setRecords] = useState<MedicationRecord[]>([])
  const [modal, setModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MedicationRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = async () => { setRecords(await fetchMedications()) }
  useEffect(() => { load() }, [])

  function openEdit(r: MedicationRecord) {
    setEditTarget(r)
    form.setFieldsValue({
      ...r,
      start_date: r.start_date ? dayjs(r.start_date) : undefined,
      end_date: r.end_date ? dayjs(r.end_date) : undefined,
    })
    setModal(true)
  }

  function closeModal() {
    setModal(false)
    setEditTarget(null)
    form.resetFields()
  }

  async function handleSubmit(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      const payload = {
        ...vals,
        start_date: vals.start_date ? (vals.start_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
        end_date: vals.end_date ? (vals.end_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
      }
      if (editTarget) {
        await updateMedication(editTarget.id, payload as Partial<MedicationRecord>)
        message.success('已更新')
      } else {
        await createMedication(payload as Partial<MedicationRecord>)
        message.success('已添加')
      }
      closeModal()
      load()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const columns = [
    {
      title: '药物名称', dataIndex: 'drug_name', key: 'name', width: 150,
      render: (v: string, r: MedicationRecord) => (
        <Space size={4}>
          <Text strong>{v}</Text>
          {r.is_aps_related && <Tag color="volcano" style={{ fontSize: 10 }}>APS</Tag>}
        </Space>
      ),
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => {
        const cfg = categoryLabels[v] ?? { text: v ?? '—', color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '剂量', key: 'dosage', width: 110,
      render: (_: unknown, r: MedicationRecord) => (
        <Text>{r.dosage ?? (r.dosage_value ? `${r.dosage_value}${r.dosage_unit ?? ''}` : '—')}</Text>
      ),
    },
    { title: '频率', dataIndex: 'frequency', key: 'freq', width: 90 },
    { title: '开始日期', dataIndex: 'start_date', key: 'start', width: 100, render: (v: string | null) => v ?? '—' },
    {
      title: '状态', key: 'status', width: 70,
      render: (_: unknown, r: MedicationRecord) =>
        !r.end_date ? <Tag color="success">用药中</Tag> : <Tag>已停药</Tag>,
    },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: '', key: 'action', width: 80,
      render: (_: unknown, r: MedicationRecord) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          <Popconfirm title="确认删除？" onConfirm={async () => { await deleteMedication(r.id); load() }}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const { printRef, handlePrint } = usePrint({ title: '用药记录' })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>用药记录</Title>
        <Space>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>添加药物</Button>
        </Space>
      </div>

      <div ref={printRef}>
      <Card size="small">
        <Table dataSource={records} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 15 }} />
      </Card>
      </div>

      <Modal
        title={editTarget ? '编辑用药记录' : '添加用药记录'}
        open={modal}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
        width={540}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="药物名称" name="drug_name" rules={[{ required: true }]}>
                <Input placeholder="如：华法林、羟氯喹、泼尼松" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="分类" name="category">
                <Select placeholder="选择分类">
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <Option key={k} value={k}>{v.text}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item label="剂量（如 3mg）" name="dosage">
                <Input placeholder="3mg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="数值剂量" name="dosage_value">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="单位" name="dosage_unit">
                <Select>
                  <Option value="mg">mg</Option>
                  <Option value="IU">IU</Option>
                  <Option value="片">片</Option>
                  <Option value="μg">μg</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="频率" name="frequency">
            <Select placeholder="选择用药频率">
              <Option value="每日一次">每日一次</Option>
              <Option value="每日两次">每日两次</Option>
              <Option value="每日三次">每日三次</Option>
              <Option value="隔日一次">隔日一次</Option>
              <Option value="每周一次">每周一次</Option>
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="开始日期" name="start_date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="停药日期（留空=用药中）" name="end_date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="APS 抗凝相关" name="is_aps_related" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
