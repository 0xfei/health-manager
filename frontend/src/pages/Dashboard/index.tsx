import { useEffect, useState, useRef } from 'react'
import {
  Row, Col, Card, Statistic, Tag, Table, Alert, Typography, Space,
  Badge, Spin, Button, Modal, Form, Input, Select, Tooltip, Divider,
  Collapse, List,
} from 'antd'
import {
  ExperimentOutlined, HeartOutlined, AlertOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  CalendarOutlined, EditOutlined, PrinterOutlined,
  RobotOutlined, UserOutlined, MedicineBoxOutlined,
  BellOutlined, ArrowRightOutlined, MedicineBoxFilled,
  FireOutlined, InfoCircleOutlined, SmileOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { fetchDashboard, fetchProfile, upsertProfile, generateAISummary, fetchAnalysis } from '../../api'
import { usePrint } from '../../hooks/usePrint'
import { useNavigate } from 'react-router-dom'
import type { DashboardSummary, IndicatorSummaryItem, AnalysisResult, ChangeEvent } from '../../types'

const { Title, Text, Paragraph } = Typography

// ── 状态辅助函数 ───────────────────────────────────────────────────────────────

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

// ── 健康档案卡片 ───────────────────────────────────────────────────────────────

interface ProfileData {
  id: string | null
  diagnosed_at: string | null
  disease_duration_note: string | null
  current_medications: string | null
  main_symptoms: string | null
  main_issues: string | null
  recovery_status: string | null
  doctor_summary: string | null
  ai_summary: string | null
  tags: string[]
  updated_at: string | null
}

const STATUS_OPTIONS = [
  { value: '稳定期', label: '稳定期', color: '#52c41a' },
  { value: '活动期', label: '活动期', color: '#ff4d4f' },
  { value: '缓解期', label: '缓解期', color: '#1677ff' },
  { value: '监测期', label: '监测期', color: '#faad14' },
]

function HealthProfileCard({ onRefresh }: { onRefresh: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [editModal, setEditModal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [form] = Form.useForm()

  const loadProfile = async () => {
    try {
      const p = await fetchProfile()
      setProfile(p as unknown as ProfileData)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => { loadProfile() }, [])

  const handleEdit = () => {
    form.setFieldsValue({
      diagnosed_at: profile?.diagnosed_at ?? '',
      disease_duration_note: profile?.disease_duration_note ?? '',
      current_medications: profile?.current_medications ?? '',
      main_symptoms: profile?.main_symptoms ?? '',
      main_issues: profile?.main_issues ?? '',
      recovery_status: profile?.recovery_status ?? '稳定期',
      doctor_summary: profile?.doctor_summary ?? '',
    })
    setEditModal(true)
  }

  const handleSave = async (vals: Record<string, string>) => {
    await upsertProfile(vals)
    setEditModal(false)
    await loadProfile()
    onRefresh()
  }

  const handleAISummary = async () => {
    setAiLoading(true)
    try {
      const r = await generateAISummary()
      if (r.ok) {
        await loadProfile()
      } else {
        alert(r.ai_summary)
      }
    } finally {
      setAiLoading(false)
    }
  }

  const statusCfg = STATUS_OPTIONS.find(o => o.value === profile?.recovery_status)
  const hasProfile = profile && (
    profile.diagnosed_at || profile.current_medications ||
    profile.main_symptoms || profile.recovery_status || profile.ai_summary
  )

  return (
    <>
      <Card
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, #f0f6ff 0%, #e8f4fd 100%)',
          border: '1px solid #c8dcf5',
          borderRadius: 12,
        }}
        bodyStyle={{ padding: '20px 24px' }}
        extra={
          <Space>
            {profile?.ai_summary && (
              <Tooltip title="重新生成 AI 摘要">
                <Button
                  size="small" icon={<RobotOutlined />} loading={aiLoading}
                  onClick={handleAISummary}
                  style={{ fontSize: 12 }}
                >
                  {aiLoading ? '生成中…' : 'AI 摘要'}
                </Button>
              </Tooltip>
            )}
            <Button size="small" icon={<EditOutlined />} onClick={handleEdit}>
              编辑档案
            </Button>
          </Space>
        }
        title={
          <Space>
            <UserOutlined style={{ color: '#3b6cbf' }} />
            <span style={{ fontWeight: 600 }}>患者健康档案</span>
            {statusCfg && (
              <Tag color={statusCfg.color} style={{ marginLeft: 4 }}>
                {statusCfg.value}
              </Tag>
            )}
          </Space>
        }
      >
        {!hasProfile ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af' }}>
            <UserOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
            <Text type="secondary">尚未填写健康档案</Text>
            <div style={{ marginTop: 12 }}>
              <Space>
                <Button type="primary" size="small" onClick={handleEdit}>
                  填写基本信息
                </Button>
                <Button size="small" icon={<RobotOutlined />} loading={aiLoading} onClick={handleAISummary}>
                  AI 自动生成摘要
                </Button>
              </Space>
            </div>
          </div>
        ) : (
          <div>
            {/* AI 摘要段落 */}
            {profile.ai_summary ? (
              <div style={{
                padding: '12px 16px',
                background: '#fff',
                borderRadius: 8,
                border: '1px solid #d1e5fa',
                marginBottom: 16,
              }}>
                <Space style={{ marginBottom: 6 }}>
                  <RobotOutlined style={{ color: '#3b6cbf', fontSize: 13 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>AI 健康摘要</Text>
                </Space>
                <Paragraph style={{ margin: 0, lineHeight: 1.7, color: '#374151', fontSize: 14 }}>
                  {profile.ai_summary}
                </Paragraph>
                {profile.updated_at && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                    更新于 {new Date(profile.updated_at).toLocaleString('zh-CN')}
                  </Text>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Button size="small" icon={<RobotOutlined />} loading={aiLoading} onClick={handleAISummary}>
                  AI 自动生成综合摘要
                </Button>
              </div>
            )}

            {/* 结构化信息 */}
            <Row gutter={[16, 8]}>
              {profile.diagnosed_at && (
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <CalendarOutlined style={{ color: '#3b6cbf', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>确诊时间</Text>
                      <Text style={{ fontSize: 13 }}>
                        {profile.diagnosed_at}
                        {profile.disease_duration_note && (
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                            （{profile.disease_duration_note}）
                          </Text>
                        )}
                      </Text>
                    </div>
                  </div>
                </Col>
              )}
              {profile.current_medications && (
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <MedicineBoxOutlined style={{ color: '#52c41a', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>当前用药</Text>
                      <Text style={{ fontSize: 13 }}>{profile.current_medications}</Text>
                    </div>
                  </div>
                </Col>
              )}
              {profile.main_symptoms && (
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <HeartOutlined style={{ color: '#faad14', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>主要症状</Text>
                      <Text style={{ fontSize: 13 }}>{profile.main_symptoms}</Text>
                    </div>
                  </div>
                </Col>
              )}
              {profile.main_issues && (
                <Col span={12}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertOutlined style={{ color: '#ff4d4f', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>主要问题</Text>
                      <Text style={{ fontSize: 13 }}>{profile.main_issues}</Text>
                    </div>
                  </div>
                </Col>
              )}
              {profile.doctor_summary && (
                <Col span={24}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ExperimentOutlined style={{ color: '#722ed1', marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>医嘱/医生评价</Text>
                      <Text style={{ fontSize: 13 }}>{profile.doctor_summary}</Text>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Card>

      {/* 编辑档案弹窗 */}
      <Modal
        title="编辑健康档案"
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => form.submit()}
        width={620}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="确诊时间（如 2020-06）" name="diagnosed_at">
                <Input placeholder="年月，如 2020-06" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="当前状态" name="recovery_status">
                <Select options={STATUS_OPTIONS} placeholder="请选择" allowClear />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="确诊时长描述" name="disease_duration_note">
                <Input placeholder="如：已确诊约 4 年" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="当前用药（简要描述）" name="current_medications">
                <Input.TextArea rows={2} placeholder="如：羟氯喹 200mg/日，醋酸泼尼松 5mg/日" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="主要症状" name="main_symptoms">
                <Input.TextArea rows={2} placeholder="如：关节痛、轻度皮疹、晨僵约 30 分钟" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="主要问题（受累器官/系统）" name="main_issues">
                <Input.TextArea rows={2} placeholder="如：狼疮肾炎（蛋白尿++）、APS 合并血栓史" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="医嘱 / 医生综合评价" name="doctor_summary">
                <Input.TextArea rows={2} placeholder="如：病情稳定，继续现有方案，3 个月后复查" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

// ── 指标总览表 ────────────────────────────────────────────────────────────────

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
  {
    title: '代码', dataIndex: 'indicator_code', key: 'code', width: 90,
    render: (v: string) => (
      <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>
    ),
  },
  {
    title: '最新值', key: 'value', width: 120,
    render: (_: unknown, r: IndicatorSummaryItem) => {
      if (r.latest_value != null)
        return (
          <Text strong style={{
            color: r.status === 'danger' ? '#ff4d4f' :
                   r.status === 'warning' ? '#faad14' : '#1a1a2e',
          }}>
            {r.latest_value}{' '}
            {r.unit && <Text type="secondary" style={{ fontSize: 11 }}>{r.unit}</Text>}
          </Text>
        )
      if (r.latest_value_text) return <Text>{r.latest_value_text}</Text>
      return <Text type="secondary">—</Text>
    },
  },
  {
    title: '参考范围', key: 'ref', width: 130,
    render: (_: unknown, r: IndicatorSummaryItem) => {
      if (r.ref_min != null && r.ref_max != null)
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.ref_min} – {r.ref_max} {r.unit}
          </Text>
        )
      if (r.ref_max != null)
        return <Text type="secondary" style={{ fontSize: 12 }}>{'< '}{r.ref_max} {r.unit}</Text>
      return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
    },
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: statusTag },
  {
    title: '检测日期', dataIndex: 'latest_date', key: 'date', width: 100,
    render: (v: string | null) =>
      v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
  },
]

// ── 变化提醒卡片 ──────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  danger:  { color: '#ff4d4f', bg: '#fff1f0', border: '#ffa39e', icon: <CloseCircleOutlined />, label: '危险' },
  warning: { color: '#faad14', bg: '#fffbe6', border: '#ffe58f', icon: <WarningOutlined />,      label: '警告' },
  info:    { color: '#1677ff', bg: '#e6f4ff', border: '#91caff', icon: <InfoCircleOutlined />,   label: '信息' },
  good:    { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', icon: <SmileOutlined />,        label: '好转' },
}

const TYPE_LABEL: Record<string, string> = {
  indicator_danger:       '越界',
  indicator_warning:      '偏离',
  indicator_recovery:     '恢复',
  indicator_trend_worse:  '趋势',
  indicator_large_change: '波动',
  medication_added:       '新药',
  medication_stopped:     '停药',
  inr_danger:             'INR',
  overdue_check:          '超期',
}

function ChangeAlertsCard() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAnalysis(90)
      .then(setResult)
      .catch(console.error)
      .finally(() => setAnalysisLoading(false))
  }, [])

  if (analysisLoading) return null
  if (!result || result.events.length === 0) return null

  const { summary } = result

  const collapseItems = [
    {
      key: 'alerts',
      label: (
        <Space>
          <BellOutlined style={{ color: summary.danger > 0 ? '#ff4d4f' : '#faad14' }} />
          <span style={{ fontWeight: 600 }}>
            指标变化提醒
            {summary.danger > 0 && (
              <span style={{ color: '#ff4d4f', marginLeft: 6 }}>·  {summary.danger} 项危险</span>
            )}
            {summary.warning > 0 && (
              <span style={{ color: '#faad14', marginLeft: 6 }}>·  {summary.warning} 项警告</span>
            )}
            {summary.good > 0 && (
              <span style={{ color: '#52c41a', marginLeft: 6 }}>·  {summary.good} 项好转</span>
            )}
          </span>
          <Text type="secondary" style={{ fontSize: 11 }}>最近 90 天</Text>
        </Space>
      ),
      children: (
        <div>
          {/* 汇总 badge 行 */}
          <Space style={{ marginBottom: 12 }} wrap>
            {(['danger', 'warning', 'info', 'good'] as const).map(lv => {
              const n = summary[lv]
              if (!n) return null
              const cfg = LEVEL_CFG[lv]
              return (
                <Tag
                  key={lv}
                  icon={cfg.icon}
                  color={lv === 'danger' ? 'error' : lv === 'warning' ? 'warning' : lv === 'good' ? 'success' : 'processing'}
                >
                  {cfg.label} {n}
                </Tag>
              )
            })}
          </Space>

          {/* 事件列表 */}
          <List
            size="small"
            dataSource={result.events}
            renderItem={(evt: ChangeEvent) => {
              const cfg = LEVEL_CFG[evt.level] ?? LEVEL_CFG.info
              return (
                <List.Item
                  style={{
                    padding: '8px 12px',
                    marginBottom: 6,
                    borderRadius: 6,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                  }}
                  actions={[
                    evt.indicator_id && (
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        icon={<ArrowRightOutlined />}
                        style={{ fontSize: 12, padding: 0 }}
                        onClick={() => navigate('/indicators')}
                      >
                        查看趋势
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <span style={{ color: cfg.color, fontSize: 16, lineHeight: 1 }}>
                        {cfg.icon}
                      </span>
                    }
                    title={
                      <Space size={4}>
                        <Text strong style={{ color: cfg.color, fontSize: 13 }}>
                          {evt.title}
                        </Text>
                        <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                          {TYPE_LABEL[evt.type] ?? evt.type}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text style={{ fontSize: 12, color: '#374151' }}>{evt.detail}</Text>
                        {evt.event_date && (
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                            <ClockCircleOutlined style={{ marginRight: 2 }} />
                            {evt.event_date}
                          </Text>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )
            }}
          />

          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            分析时间：{result.generated_at}
          </Text>
        </div>
      ),
    },
  ]

  return (
    <Collapse
      defaultActiveKey={['alerts']}
      style={{ marginBottom: 20 }}
      items={collapseItems}
    />
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { printRef, handlePrint } = usePrint({ title: '健康总览' })

  const loadDashboard = () => {
    fetchDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDashboard() }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>

  const abnormal = data?.indicators.filter(i => i.status !== 'normal' && i.status !== 'unknown') ?? []
  const danger = abnormal.filter(i => i.status === 'danger')
  const withData = data?.indicators.filter(i => i.status !== 'unknown') ?? []

  return (
    <div>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>健康总览</Title>
        <Button icon={<PrinterOutlined />} onClick={handlePrint} size="small">
          打印
        </Button>
      </div>

      {/* 打印区域 */}
      <div ref={printRef}>
        {/* 健康档案卡片 */}
        <HealthProfileCard onRefresh={loadDashboard} />

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
              {data?.last_update && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  最后更新：{data.last_update}
                </Text>
              )}
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
              {danger.length > 0 && (
                <Text type="danger" style={{ fontSize: 11 }}>
                  其中 {danger.length} 项预警
                </Text>
              )}
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

        {/* 变化提醒卡片 */}
        <ChangeAlertsCard />

        {/* 指标总览表 */}
        <Card
          title={<Space><ExperimentOutlined /><span>指标最新值（有数据）</span></Space>}
          size="small"
        >
          <Table
            dataSource={(data?.indicators ?? []).filter(i => i.status !== 'unknown')}
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
    </div>
  )
}
