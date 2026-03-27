import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Select, Button, Divider, Typography, Space,
  message, Alert, Table, InputNumber, Modal, Tag, Tabs, Badge,
} from 'antd'
import { SaveOutlined, ReloadOutlined, ExperimentOutlined } from '@ant-design/icons'
import axios from 'axios'
import { fetchDefinitions, updateDefinition } from '../../api'
import type { IndicatorDefinition } from '../../types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

const STORAGE_KEY = 'sle_health_settings'

interface ParseSettings {
  ai_provider: 'openai' | 'ollama'
  ai_model: string
  api_key: string
  base_url: string
  ocr_engine: 'paddleocr' | 'tesseract' | 'none'
  use_vision: boolean
  symptom_provider: 'openai' | 'ollama' | 'rule_based'
}

const defaults: ParseSettings = {
  ai_provider: 'ollama',
  ai_model: 'qwen2.5:7b',
  api_key: '',
  base_url: 'http://localhost:11434/v1',
  ocr_engine: 'paddleocr',
  use_vision: false,
  symptom_provider: 'ollama',
}

// ── 解析配置页 ────────────────────────────────────────────
function ParseConfigTab() {
  const [form] = Form.useForm()
  const [serverCfg, setServerCfg] = useState<Record<string, unknown> | null>(null)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    form.setFieldsValue(saved ? JSON.parse(saved) : defaults)
    // 读取服务端实际配置
    axios.get('/api/config').then(r => setServerCfg(r.data)).catch(() => {})
  }, [])

  function handleSave(vals: ParseSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vals))
    message.success('前端配置已保存（修改后端配置请编辑 backend/config.yaml）')
  }

  async function handleReload() {
    setReloading(true)
    try {
      const r = await axios.post('/api/config/reload')
      message.success(r.data.message)
      const cfg = await axios.get('/api/config')
      setServerCfg(cfg.data)
    } catch {
      message.error('重载失败')
    } finally { setReloading(false) }
  }

  const parse = serverCfg?.parse as Record<string, Record<string, string>> | undefined

  return (
    <div>
      {/* 服务端实际配置展示 */}
      {parse && (
        <Card size="small" title="后端当前解析配置（来自 backend/config.yaml）" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { label: '文本解析', key: 'text' },
              { label: '图片解析', key: 'image' },
              { label: '文档解析', key: 'document' },
              { label: '症状解析', key: 'symptom' },
            ].map(({ label, key }) => {
              const c = parse[key]
              const color = c?.provider === 'disabled' ? 'default' :
                c?.provider === 'rule_based' ? 'orange' :
                c?.provider === 'ollama' ? 'blue' : 'green'
              return (
                <div key={key} style={{ padding: '8px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e8edf4', minWidth: 180 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={color}>{c?.provider}</Tag>
                    <Text style={{ fontSize: 12 }}>{c?.model}</Text>
                  </div>
                  {key === 'image' && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>OCR: {(parse.image as Record<string, string>)?.ocr_engine}</Text>}
                </div>
              )
            })}
          </div>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              修改解析方式：编辑 <code>backend/config.yaml</code> 后点击重载
            </Text>
            <Button size="small" icon={<ReloadOutlined />} loading={reloading} onClick={handleReload}>
              重载配置
            </Button>
          </Space>
        </Card>
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="解析模式说明"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div><Tag color="blue">ollama</Tag> 本地离线模型，安装 Ollama 后拉取 <code>qwen2.5:7b</code>（~4GB），完全私密</div>
            <div><Tag color="green">openai</Tag> OpenAI API 或任何兼容接口（Azure / 通义千问 / LM Studio 等）</div>
            <div><Tag color="orange">rule_based</Tag> 症状解析专用，无需任何 AI，基于关键词匹配，完全离线</div>
            <div><Tag color="default">disabled</Tag> 关闭该解析功能</div>
          </div>
        }
      />

      <Card size="small" title="配置文件路径">
        <Paragraph style={{ margin: 0, fontFamily: 'monospace', fontSize: 13 }}>
          {(serverCfg?.config_file as string) || 'backend/config.yaml'}
        </Paragraph>
        <Text type="secondary" style={{ fontSize: 12 }}>
          直接编辑此文件修改解析配置，改完后点击「重载配置」生效，无需重启服务。
        </Text>
      </Card>
    </div>
  )
}


// ── 指标阈值编辑页 ────────────────────────────────────────────
function ThresholdTab() {
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>([])
  const [editTarget, setEditTarget] = useState<IndicatorDefinition | null>(null)
  const [modal, setModal] = useState(false)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const load = async () => { setDefinitions(await fetchDefinitions()) }
  useEffect(() => { load() }, [])

  function openEdit(d: IndicatorDefinition) {
    setEditTarget(d)
    form.setFieldsValue({
      ref_min: d.ref_min,
      ref_max: d.ref_max,
      warn_low: d.warn_low,
      warn_high: d.warn_high,
    })
    setModal(true)
  }

  async function handleSave(vals: Partial<IndicatorDefinition>) {
    if (!editTarget) return
    setLoading(true)
    try {
      await updateDefinition(editTarget.id, {
        ...editTarget,
        ...vals,
        is_system: editTarget.is_system,
      })
      message.success(`${editTarget.name} 阈值已更新`)
      setModal(false)
      load()
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally { setLoading(false) }
  }

  const columns = [
    { title: '指标', dataIndex: 'name', key: 'name', width: 150,
      render: (v: string, r: IndicatorDefinition) => (
        <Space size={4}>
          <Text strong>{v}</Text>
          {!r.is_system && <Tag color="blue" style={{ fontSize: 10 }}>自定义</Tag>}
        </Space>
      ),
    },
    { title: '代码', dataIndex: 'code', key: 'code', width: 100,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    { title: '分类', dataIndex: 'category', key: 'cat', width: 90,
      render: (v: string) => <Tag>{v ?? '—'}</Tag>,
    },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 70 },
    {
      title: '正常范围', key: 'ref', width: 130,
      render: (_: unknown, r: IndicatorDefinition) => {
        if (r.ref_min != null && r.ref_max != null)
          return <Text style={{ color: '#52c41a', fontSize: 12 }}>{r.ref_min} – {r.ref_max}</Text>
        if (r.ref_max != null) return <Text style={{ color: '#52c41a', fontSize: 12 }}>{'< '}{r.ref_max}</Text>
        if (r.ref_min != null) return <Text style={{ color: '#52c41a', fontSize: 12 }}>{'>= '}{r.ref_min}</Text>
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: '预警线', key: 'warn', width: 130,
      render: (_: unknown, r: IndicatorDefinition) => {
        const parts = []
        if (r.warn_low != null) parts.push(`↓ ${r.warn_low}`)
        if (r.warn_high != null) parts.push(`↑ ${r.warn_high}`)
        return parts.length
          ? <Text style={{ color: '#ff4d4f', fontSize: 12 }}>{parts.join('  ')}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: '', key: 'action', width: 70,
      render: (_: unknown, r: IndicatorDefinition) => (
        <Button size="small" onClick={() => openEdit(r)}>编辑阈值</Button>
      ),
    },
  ]

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="阈值说明"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div><Tag color="success">正常范围</Tag> ref_min ~ ref_max：绿色参考线，超出则显示黄色"偏高/偏低"</div>
            <div><Tag color="error">预警线</Tag> warn_low / warn_high：红色预警线，超出则显示红色"预警"</div>
            <div>修改后立即生效，同时更新曲线图和仪表盘状态颜色</div>
          </div>
        }
      />
      <Card size="small">
        <Table
          dataSource={definitions}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, size: 'small' }}
        />
      </Card>

      <Modal
        title={`编辑阈值：${editTarget?.name}`}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
        destroyOnClose
        width={420}
      >
        <Alert
          type="warning"
          message="阈值修改将影响仪表盘和曲线图中的状态判断，请根据个人情况（性别、年龄、医嘱）调整。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={<span style={{ color: '#52c41a' }}>正常下限 (ref_min)</span>}
              name="ref_min"
            >
              <InputNumber style={{ width: '100%' }} placeholder="留空=不设" step={0.1} />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: '#52c41a' }}>正常上限 (ref_max)</span>}
              name="ref_max"
            >
              <InputNumber style={{ width: '100%' }} placeholder="留空=不设" step={0.1} />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: '#ff4d4f' }}>预警下限 (warn_low)</span>}
              name="warn_low"
            >
              <InputNumber style={{ width: '100%' }} placeholder="留空=不设" step={0.1} />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: '#ff4d4f' }}>预警上限 (warn_high)</span>}
              name="warn_high"
            >
              <InputNumber style={{ width: '100%' }} placeholder="留空=不设" step={0.1} />
            </Form.Item>
          </div>
          {editTarget?.unit && (
            <Text type="secondary" style={{ fontSize: 12 }}>单位：{editTarget.unit}</Text>
          )}
        </Form>
      </Modal>
    </div>
  )
}


// ── INR 目标区间 ────────────────────────────────────────────
function INRTab() {
  const [form] = Form.useForm()

  useEffect(() => {
    const saved = localStorage.getItem('sle_inr_settings')
    if (saved) form.setFieldsValue(JSON.parse(saved))
    else form.setFieldsValue({ target_min: 2.0, target_max: 3.0, warn_low: 1.8, warn_high: 3.5 })
  }, [])

  function handleSave(vals: Record<string, number>) {
    localStorage.setItem('sle_inr_settings', JSON.stringify(vals))
    message.success('INR 设置已保存')
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="INR 目标区间由主诊医生决定。静脉血栓标准为 2.0-3.0，高风险 APS 或动脉血栓可能为 2.5-3.5。"
      />
      <Card size="small" style={{ maxWidth: 500 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label={<span style={{ color: '#52c41a' }}>目标下限</span>} name="target_min">
              <InputNumber style={{ width: '100%' }} step={0.1} precision={1} />
            </Form.Item>
            <Form.Item label={<span style={{ color: '#52c41a' }}>目标上限</span>} name="target_max">
              <InputNumber style={{ width: '100%' }} step={0.1} precision={1} />
            </Form.Item>
            <Form.Item label={<span style={{ color: '#ff4d4f' }}>预警下限</span>} name="warn_low">
              <InputNumber style={{ width: '100%' }} step={0.1} precision={1} />
            </Form.Item>
            <Form.Item label={<span style={{ color: '#ff4d4f' }}>预警上限</span>} name="warn_high">
              <InputNumber style={{ width: '100%' }} step={0.1} precision={1} />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>保存 INR 设置</Button>
        </Form>
      </Card>
    </div>
  )
}


// ── 主页面 ────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>系统设置</Title>
      <Tabs
        items={[
          {
            key: 'parse',
            label: <span><ExperimentOutlined />解析配置</span>,
            children: <ParseConfigTab />,
          },
          {
            key: 'threshold',
            label: <span>指标阈值管理</span>,
            children: <ThresholdTab />,
          },
          {
            key: 'inr',
            label: <span>INR 目标区间</span>,
            children: <INRTab />,
          },
        ]}
      />
    </div>
  )
}
