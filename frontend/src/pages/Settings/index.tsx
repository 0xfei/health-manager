import { useState, useEffect } from 'react'
import {
  Card, Form, Input, Select, Button, Typography, Space, Tabs,
  message, Alert, Table, InputNumber, Modal, Tag, Switch, Divider,
  Row, Col, Tooltip, Badge,
} from 'antd'
import {
  SaveOutlined, ReloadOutlined, ExperimentOutlined,
  CheckCircleOutlined, ApiOutlined, SettingOutlined,
} from '@ant-design/icons'
import { fetchDefinitions, updateDefinition, fetchFullConfig, updateConfig } from '../../api'
import type { IndicatorDefinition } from '../../types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

// ── 解析配置表单结构 ─────────────────────────────────────────────────────────

interface ModuleConfig {
  provider: string
  model: string
  api_key: string
  base_url: string
  timeout?: number
  // image 专属
  ocr_engine?: string
  ocr_lang?: string
  use_vision?: boolean
  // document 专属
  pdf_backend?: string
  fallback_to_image?: boolean
}

interface FullParseConfig {
  text: ModuleConfig
  image: ModuleConfig
  document: ModuleConfig
  symptom: ModuleConfig
}

const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Ollama（本地模型，推荐）' },
  { value: 'openai', label: 'OpenAI / 兼容接口（通义千问/LM Studio 等）' },
  { value: 'disabled', label: 'disabled（关闭此解析功能）' },
]

const SYMPTOM_PROVIDER_OPTIONS = [
  ...PROVIDER_OPTIONS,
  { value: 'rule_based', label: 'rule_based（无需 AI，关键词规则匹配）' },
]

const OCR_OPTIONS = [
  { value: 'paddleocr', label: 'PaddleOCR（推荐，中文精度高）' },
  { value: 'tesseract', label: 'Tesseract（英文较好）' },
  { value: 'none', label: 'none（跳过 OCR，直接使用多模态模型）' },
]

const PDF_OPTIONS = [
  { value: 'pymupdf', label: 'pymupdf（推荐，速度快）' },
  { value: 'pdfplumber', label: 'pdfplumber（布局保留更好）' },
  { value: 'pypdf2', label: 'pypdf2（兼容性最广）' },
]

const providerColor = (p: string) => {
  if (p === 'ollama') return 'blue'
  if (p === 'openai') return 'green'
  if (p === 'rule_based') return 'orange'
  return 'default'
}

// ── 单个模块配置卡片 ──────────────────────────────────────────────────────────

interface ModuleCardProps {
  title: string
  icon: React.ReactNode
  form: ReturnType<typeof Form.useForm>[0]
  isSymptom?: boolean
  isImage?: boolean
  isDocument?: boolean
  initialValues?: ModuleConfig
}

function ModuleConfigCard({ title, icon, form, isSymptom, isImage, isDocument }: ModuleCardProps) {
  const provider = Form.useWatch('provider', form)
  const needsLLM = provider !== 'disabled' && provider !== 'rule_based'
  const useVision = Form.useWatch('use_vision', form)

  return (
    <Card
      size="small"
      title={<Space>{icon}<Text strong>{title}</Text></Space>}
      style={{ marginBottom: 16 }}
      extra={
        provider && (
          <Badge
            status={provider === 'disabled' ? 'default' : 'processing'}
            text={<Tag color={providerColor(provider)}>{provider}</Tag>}
          />
        )
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="解析引擎（Provider）" name="provider" rules={[{ required: true }]}>
              <Select
                options={isSymptom ? SYMPTOM_PROVIDER_OPTIONS : PROVIDER_OPTIONS}
                placeholder="选择解析引擎"
              />
            </Form.Item>
          </Col>

          {/* 图片 OCR 专属 */}
          {isImage && !useVision && (
            <Col span={12}>
              <Form.Item label="OCR 引擎" name="ocr_engine">
                <Select options={OCR_OPTIONS} placeholder="选择 OCR 引擎" />
              </Form.Item>
            </Col>
          )}

          {/* PDF 解析专属 */}
          {isDocument && (
            <Col span={12}>
              <Form.Item label="PDF 解析后端" name="pdf_backend">
                <Select options={PDF_OPTIONS} />
              </Form.Item>
            </Col>
          )}

          {/* 图片 Vision 模式开关 */}
          {isImage && (
            <Col span={12}>
              <Form.Item label="使用多模态（Vision）模式" name="use_vision" valuePropName="checked">
                <Switch
                  checkedChildren="Vision 模式（直接发图片给模型）"
                  unCheckedChildren="OCR 模式（先 OCR 再文本解析）"
                />
              </Form.Item>
            </Col>
          )}
        </Row>

        {needsLLM && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="模型名称（Model）"
                  name="model"
                  tooltip="Ollama: qwen2.5:7b / llava:13b; OpenAI: gpt-4o / gpt-4-turbo"
                >
                  <Input placeholder="如: qwen2.5:7b 或 gpt-4o" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="API Base URL"
                  name="base_url"
                  tooltip="Ollama: http://localhost:11434/v1 | OpenAI: https://api.openai.com/v1 | 通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1"
                >
                  <Input placeholder="http://localhost:11434/v1" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  label="API Key"
                  name="api_key"
                  tooltip="Ollama 本地模型留空即可；OpenAI / 通义千问等填写对应 API Key"
                >
                  <Input.Password
                    placeholder="Ollama 留空；OpenAI/通义千问填写 sk-xxx"
                    visibilityToggle
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="超时（秒）" name="timeout">
                  <InputNumber min={5} max={300} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        {isDocument && needsLLM && (
          <Form.Item name="fallback_to_image" valuePropName="checked">
            <Switch
              checkedChildren="PDF 文字提取失败时自动转图片流程"
              unCheckedChildren="不启用 fallback"
            />
          </Form.Item>
        )}
      </Form>
    </Card>
  )
}

// ── 解析配置主 Tab ─────────────────────────────────────────────────────────────

function ParseConfigTab() {
  const [textForm] = Form.useForm()
  const [imageForm] = Form.useForm()
  const [docForm] = Form.useForm()
  const [symptomForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  const loadConfig = async () => {
    setLoading(true)
    try {
      const cfg = await fetchFullConfig() as { parse: FullParseConfig }
      textForm.setFieldsValue(cfg.parse.text)
      imageForm.setFieldsValue(cfg.parse.image)
      docForm.setFieldsValue(cfg.parse.document)
      symptomForm.setFieldsValue(cfg.parse.symptom)
    } catch {
      message.error('获取配置失败，请确认后端已启动')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // 并行验证所有表单
      const [textVals, imageVals, docVals, symptomVals] = await Promise.all([
        textForm.validateFields(),
        imageForm.validateFields(),
        docForm.validateFields(),
        symptomForm.validateFields(),
      ])

      const payload = {
        parse: {
          text: textVals,
          image: imageVals,
          document: docVals,
          symptom: symptomVals,
        },
      }

      const result = await updateConfig(payload)
      message.success(result.message || '配置已保存并生效')
    } catch (e: unknown) {
      message.error(`保存失败: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="AI 解析服务配置"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.9 }}>
            <div>
              <Tag color="blue">Ollama（推荐）</Tag>
              本地运行，完全私密。安装 Ollama 后执行：
              <code style={{ background: '#f0f4fa', padding: '1px 6px', borderRadius: 4 }}>
                ollama pull qwen2.5:7b
              </code>
              ，默认地址 <code>http://localhost:11434/v1</code>
            </div>
            <div>
              <Tag color="green">OpenAI / 兼容接口</Tag>
              支持 OpenAI、通义千问、LM Studio、Azure 等任何 OpenAI 格式 API
            </div>
            <div>
              <Tag color="orange">rule_based</Tag> 症状解析专用，无需 AI，基于关键词离线匹配
            </div>
            <div style={{ marginTop: 4, color: '#6b7280' }}>
              修改后点击「保存并生效」，配置将写入 config.yaml 并立即热重载，无需重启服务。
            </div>
          </div>
        }
      />

      <ModuleConfigCard
        title="文本解析（Text）— 文字化验单 / 报告 / TXT 文件"
        icon={<ExperimentOutlined style={{ color: '#3b6cbf' }} />}
        form={textForm}
      />

      <ModuleConfigCard
        title="图片解析（Image）— 照片 / 截图"
        icon={<ExperimentOutlined style={{ color: '#52c41a' }} />}
        form={imageForm}
        isImage
      />

      <ModuleConfigCard
        title="文档解析（Document）— PDF / Word / Excel"
        icon={<ExperimentOutlined style={{ color: '#722ed1' }} />}
        form={docForm}
        isDocument
      />

      <ModuleConfigCard
        title="症状解析（Symptom）— 自然语言症状描述"
        icon={<ExperimentOutlined style={{ color: '#faad14' }} />}
        form={symptomForm}
        isSymptom
      />

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadConfig}
          loading={loading}
        >
          重新读取
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存并生效
        </Button>
      </div>

      <Divider style={{ margin: '24px 0 16px' }} />

      <Card size="small" title="常用配置示例" style={{ background: '#fafbff' }}>
        <div style={{ fontSize: 12, lineHeight: 2 }}>
          <div><Text strong>Ollama 本地部署：</Text></div>
          <div>provider = <code>ollama</code>，model = <code>qwen2.5:7b</code>，base_url = <code>http://localhost:11434/v1</code>，api_key 留空</div>
          <Divider style={{ margin: '8px 0' }} />
          <div><Text strong>OpenAI GPT-4o：</Text></div>
          <div>provider = <code>openai</code>，model = <code>gpt-4o</code>，base_url = <code>https://api.openai.com/v1</code>，api_key = <code>sk-xxx</code></div>
          <Divider style={{ margin: '8px 0' }} />
          <div><Text strong>通义千问（阿里云）：</Text></div>
          <div>provider = <code>openai</code>，model = <code>qwen-turbo</code>，base_url = <code>https://dashscope.aliyuncs.com/compatible-mode/v1</code>，api_key = 填写 DashScope Key</div>
          <Divider style={{ margin: '8px 0' }} />
          <div><Text strong>LM Studio / 任何 OpenAI 兼容 API：</Text></div>
          <div>provider = <code>openai</code>，base_url = 本地或远程地址，api_key 按需填写</div>
        </div>
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
            label: <span><ApiOutlined />解析配置</span>,
            children: <ParseConfigTab />,
          },
          {
            key: 'threshold',
            label: <span><SettingOutlined />指标阈值管理</span>,
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
