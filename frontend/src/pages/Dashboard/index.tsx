import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Tag, Table, Alert, Typography, Space, Badge, Spin } from 'antd'
import {
  ExperimentOutlined, HeartOutlined, AlertOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { fetchDashboard } from '../../api'
import type { DashboardSummary, IndicatorSummaryItem } from '../../types'

const { Title, Text } = Typography

function statusIcon(s: string) {
  if (s === 'normal') return <CheckCircleOutlined style={{ color: '#52c41a' }} />
  if (s === 'warning') return <WarningOutlined style={{ color: '#faad14' }} />
  if (s === 'danger') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
  return <span style={{ color: '#9ca3af' }}>—</span>
}

function statusTag(s: string) {
  const map: Record<string, { color: string; text: string }> = {
    normal: { color: 'success', text: '正常' },
    warning: { color: 'warning', text: '偏高/偏低' },
    danger: { color: 'error', text: '预警' },
    unknown: { color: 'default', text: '无数据' },
  }
  const cfg = map[s] ?? map.unknown
  return <Tag color={cfg.color}>{cfg.text}</Tag>
}

function inrStatusBadge(val: number | null | undefined) {
  if (val == null) return <Text type="secondary">无记录</Text>
  if (val < 1.8) return <Badge status="error" text={`${val} (抗凝不足)`} />
  if (val > 3.5) return <Badge status="error" text={`${val} (出血风险)`} />
  if (val >= 2.0 && val <= 3.0) return <Badge status="success" text={`${val} (达标)`} />
  return <Badge status="warning" text={`${val} (接近边界)`} />
}

const columns = [
  {
    title: '指标', dataIndex: 'indicator_name', key: 'name', width: 140,
    render: (v: string, r: IndicatorSummaryItem) => (
      <Space size={4}>
        {statusIcon(r.status)}
        <Text strong>{v}</Text>
      </Space>
    ),
  },
  { title: '代码', dataIndex: 'indicator_code', key: 'code', width: 90, render: (v: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
  {
    title: '最新值', key: 'value', width: 110,
    render: (_: unknown, r: IndicatorSummaryItem) => {
      if (r.latest_value != null)
        return <Text strong style={{ color: r.status === 'danger' ? '#ff4d4f' : r.status === 'warning' ? '#faad14' : '#1a1a2e' }}>
          {r.latest_value} {r.unit && <Text type="secondary" style={{ fontSize: 11 }}>{r.unit}</Text>}
        </Text>
      if (r.latest_value_text) return <Text>{r.latest_value_text}</Text>
      return <Text type="secondary">—</Text>
    },
  },
  {
    title: '参考范围', key: 'ref', width: 130,
    render: (_: unknown, r: IndicatorSummaryItem) => {
      if (r.ref_min != null && r.ref_max != null)
        return <Text type="secondary" style={{ fontSize: 12 }}>{r.ref_min} – {r.ref_max} {r.unit}</Text>
      if (r.ref_max != null) return <Text type="secondary" style={{ fontSize: 12 }}>{'< '}{r.ref_max} {r.unit}</Text>
      return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
    },
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: statusTag },
  {
    title: '检测日期', dataIndex: 'latest_date', key: 'date', width: 100,
    render: (v: string | null) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
  },
]

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const abnormal = data?.indicators.filter(i => i.status !== 'normal' && i.status !== 'unknown') ?? []
  const danger = abnormal.filter(i => i.status === 'danger')
  const withData = data?.indicators.filter(i => i.status !== 'unknown') ?? []

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>健康总览</Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stat-card" size="small">
            <Statistic
              title="检验记录总数"
              value={data?.total_records ?? 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#3b6cbf' }}
            />
            {data?.last_update && <Text type="secondary" style={{ fontSize: 11 }}>最后更新：{data.last_update}</Text>}
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card" size="small">
            <Statistic
              title="有数据指标"
              value={withData.length}
              suffix={`/ ${data?.indicators.length ?? 0}`}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card" size="small">
            <Statistic
              title="异常指标"
              value={abnormal.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: abnormal.length > 0 ? '#faad14' : '#52c41a' }}
            />
            {danger.length > 0 && <Text type="danger" style={{ fontSize: 11 }}>其中 {danger.length} 项预警</Text>}
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card" size="small">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>最新 INR</Text>
              <div style={{ marginTop: 8 }}>
                {inrStatusBadge(data?.inr_latest?.inr_value)}
              </div>
              {data?.inr_latest?.log_date && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  {data.inr_latest.log_date}
                </Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 复查提醒 */}
      {(data?.upcoming_tests?.length ?? 0) > 0 && (
        <Alert
          icon={<CalendarOutlined />}
          type="info"
          showIcon
          message="近期复查提醒"
          description={data!.upcoming_tests.join('　·　')}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* 指标总览表 */}
      <Card
        title={<Space><ExperimentOutlined /><span>所有指标最新值</span></Space>}
        size="small"
      >
        <Table
          dataSource={data?.indicators ?? []}
          columns={columns}
          rowKey="indicator_id"
          size="small"
          pagination={false}
          scroll={{ x: 700 }}
          rowClassName={(r) =>
            r.status === 'danger' ? 'ant-table-row-danger' :
            r.status === 'warning' ? 'ant-table-row-warning' : ''
          }
        />
      </Card>
    </div>
  )
}
