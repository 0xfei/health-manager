import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  DatePicker, Space, Typography, Tag, Popconfirm, message, Badge, Row, Col, Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined, AlertOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchINRLogs, fetchINRTimeline, createINRLog, deleteINRLog } from '../../api'
import type { INRDoseLog, INRTimelinePoint } from '../../types'
import INRDoseChart from '../../components/INRDoseChart'
import { usePrint } from '../../hooks/usePrint'

const { Title, Text } = Typography

function inrStatus(v: number | null | undefined): { color: string; text: string; badgeStatus: 'success' | 'warning' | 'error' | 'default' } {
  if (v == null) return { color: '#9ca3af', text: '无数据', badgeStatus: 'default' }
  if (v < 1.8) return { color: '#ff4d4f', text: '抗凝不足 ⚠', badgeStatus: 'error' }
  if (v > 3.5) return { color: '#ff4d4f', text: '出血风险 ⚠', badgeStatus: 'error' }
  if (v >= 2.0 && v <= 3.0) return { color: '#52c41a', text: '达标', badgeStatus: 'success' }
  return { color: '#faad14', text: '接近边界', badgeStatus: 'warning' }
}

export default function APSPage() {
  const { printRef, handlePrint } = usePrint({ title: '抗凝记录' })
  const [logs, setLogs] = useState<INRDoseLog[]>([])
  const [timeline, setTimeline] = useState<INRTimelinePoint[]>([])
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    const [l, t] = await Promise.all([fetchINRLogs(), fetchINRTimeline()])
    setLogs(l)
    setTimeline(t)
  }

  useEffect(() => { load() }, [])

  const latest = logs[0]
  const latestStatus = inrStatus(latest?.inr_value)

  async function handleAdd(vals: Record<string, unknown>) {
    setLoading(true)
    try {
      await createINRLog({
        log_date: (vals.log_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        inr_value: vals.inr_value as number | undefined,
        warfarin_dose: vals.warfarin_dose as number | undefined,
        note: vals.note as string | undefined,
        next_test_date: vals.next_test_date
          ? (vals.next_test_date as dayjs.Dayjs).format('YYYY-MM-DD')
          : undefined,
      })
      message.success('记录已添加')
      setModal(false)
      form.resetFields()
      load()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const columns = [
    {
      title: '日期', dataIndex: 'log_date', key: 'date', width: 100,
      sorter: (a: INRDoseLog, b: INRDoseLog) => a.log_date.localeCompare(b.log_date),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'INR 值', dataIndex: 'inr_value', key: 'inr', width: 100,
      render: (v: number | null) => {
        const s = inrStatus(v)
        return v != null ? <Text strong style={{ color: s.color }}>{v}</Text> : <Text type="secondary">—</Text>
      },
    },
    {
      title: '状态', key: 'status', width: 110,
      render: (_: unknown, r: INRDoseLog) => {
        const s = inrStatus(r.inr_value)
        return <Badge status={s.badgeStatus} text={s.text} />
      },
    },
    {
      title: '华法林剂量', dataIndex: 'warfarin_dose', key: 'dose', width: 110,
      render: (v: number | null) => v != null ? <Text>{v} mg</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '下次复查', dataIndex: 'next_test_date', key: 'next', width: 100,
      render: (v: string | null) => {
        if (!v) return <Text type="secondary">—</Text>
        const diff = dayjs(v).diff(dayjs(), 'day')
        const color = diff <= 3 ? '#ff4d4f' : diff <= 7 ? '#faad14' : '#52c41a'
        return <Text style={{ color }}>{v} ({diff >= 0 ? `还剩${diff}天` : '已过期'})</Text>
      },
    },
    { title: '备注', dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: INRDoseLog) => (
        <Popconfirm title="确认删除？" onConfirm={async () => { await deleteINRLog(r.id); load() }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>抗凝记录</Title>
        <Space>
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>添加 INR 记录</Button>
        </Space>
      </div>

      <div ref={printRef}>
        {/* 最新状态卡片 */}
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card className="stat-card" size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>最新 INR</Text>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: latestStatus.color }}>
                {latest?.inr_value ?? '—'}
              </div>
              <Badge status={latestStatus.badgeStatus} text={latestStatus.text} />
              {latest?.log_date && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  {latest.log_date}
                </Text>
              )}
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stat-card" size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>最新华法林剂量</Text>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: '#d97706' }}>
                {latest?.warfarin_dose != null ? `${latest.warfarin_dose} mg` : '—'}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>每日剂量</Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stat-card" size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>下次复查</Text>
              {latest?.next_test_date ? (
                <>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700 }}>{latest.next_test_date}</div>
                  {(() => {
                    const diff = dayjs(latest.next_test_date).diff(dayjs(), 'day')
                    return (
                      <Text style={{ color: diff <= 3 ? '#ff4d4f' : '#6b7280', fontSize: 12 }}>
                        {diff >= 0 ? `还剩 ${diff} 天` : '已过期，请尽快复查'}
                      </Text>
                    )
                  })()}
                </>
              ) : (
                <div style={{ marginTop: 8, color: '#9ca3af' }}>未设置</div>
              )}
            </Card>
          </Col>
        </Row>

        {/* INR 参考说明 */}
        <Alert
          type="info"
          showIcon
          icon={<AlertOutlined />}
          message="INR 目标区间说明"
          description="静脉血栓：目标 2.0 – 3.0 | 动脉血栓/高风险 APS：目标 2.5 – 3.5（请遵医嘱）| 低于 1.8 提示抗凝不足，高于 3.5 提示出血风险"
          style={{ marginBottom: 20 }}
        />

        {/* INR + 华法林剂量联合趋势图 */}
        {timeline.length > 0 && (
          <Card title="INR 趋势 + 华法林剂量（双轴联合图，仅含 INR 检测日）" size="small" style={{ marginBottom: 20 }}>
            <INRDoseChart data={timeline} height={360} />
          </Card>
        )}

        {/* 记录表 */}
        <Card title="每日用药记录" size="small">
          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15, size: 'small' }}
            locale={{ emptyText: '暂无记录' }}
          />
        </Card>
      </div>

      {/* Add Modal */}
      <Modal
        title="添加 INR 记录"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAdd} style={{ marginTop: 16 }}>
          <Form.Item label="日期" name="log_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="INR 值" name="inr_value">
                <InputNumber style={{ width: '100%' }} step={0.1} precision={1} placeholder="如：2.3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="华法林剂量 (mg)" name="warfarin_dose">
                <InputNumber style={{ width: '100%' }} step={0.5} precision={1} placeholder="如：3.0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="下次复查日期" name="next_test_date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="备注（医生指示等）" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
