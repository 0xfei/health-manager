import { useState, useEffect } from 'react'
import {
  Card, Upload, Button, Typography, Table, Tag, Space, message,
  Spin, Alert, Badge, Divider, Select, Popconfirm, Tooltip,
  Modal, InputNumber, Input, Row, Col, Steps, Progress,
} from 'antd'
import {
  InboxOutlined, DeleteOutlined, CheckOutlined, SyncOutlined,
  LoadingOutlined, FileOutlined, FileImageOutlined, FilePdfOutlined,
  FileExcelOutlined, FileWordOutlined, WarningOutlined,
  PrinterOutlined, EditOutlined,
} from '@ant-design/icons'
import { uploadFile, analyzeUpload, confirmUpload, fetchDefinitions, deleteUpload } from '../../api'
import { usePrint } from '../../hooks/usePrint'
import type { IndicatorDefinition } from '../../types'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload
const { Step } = Steps

// ── 类型定义 ──────────────────────────────────────────────────────────────────

interface ParsedIndicator {
  name: string
  code?: string
  value?: number | null
  value_text?: string | null
  unit?: string | null
  ref_range?: string | null
  recorded_at?: string | null
  // 前端补充的匹配信息
  indicator_id?: string
  matched?: boolean
  auto_create?: boolean
  skip?: boolean
}

interface UploadTask {
  id: string
  name: string
  fileType: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  errorMsg?: string
  parsedResult?: {
    report_date?: string
    hospital?: string
    confidence?: number
    indicators: ParsedIndicator[]
  }
  confirmed?: boolean
  importResult?: { imported: number; skipped: string[] }
}

// ── 文件类型图标 ──────────────────────────────────────────────────────────────

function FileTypeIcon({ type }: { type: string }) {
  if (type === 'image') return <FileImageOutlined style={{ color: '#3b6cbf' }} />
  if (type === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
  if (type === 'excel') return <FileExcelOutlined style={{ color: '#52c41a' }} />
  if (type === 'doc') return <FileWordOutlined style={{ color: '#1677ff' }} />
  return <FileOutlined style={{ color: '#9ca3af' }} />
}

// ── 解析状态标签 ──────────────────────────────────────────────────────────────

function StatusTag({ status, errorMsg }: { status: string; errorMsg?: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    pending: { color: 'default', icon: null, text: '待解析' },
    processing: { color: 'processing', icon: <LoadingOutlined />, text: '解析中…' },
    done: { color: 'success', icon: <CheckOutlined />, text: '解析完成' },
    failed: { color: 'error', icon: <WarningOutlined />, text: '解析失败' },
  }
  const cfg = map[status] ?? map.pending
  return (
    <Tooltip title={errorMsg}>
      <Tag color={cfg.color} icon={cfg.icon}>{cfg.text}</Tag>
    </Tooltip>
  )
}

// ── 指标预览 + 匹配编辑 ──────────────────────────────────────────────────────

interface IndicatorPreviewProps {
  task: UploadTask
  definitions: IndicatorDefinition[]
  onUpdate: (items: ParsedIndicator[]) => void
}

function IndicatorPreviewTable({ task, definitions, onUpdate }: IndicatorPreviewProps) {
  const indicators = task.parsedResult?.indicators ?? []
  const [items, setItems] = useState<ParsedIndicator[]>(indicators)

  useEffect(() => { setItems(indicators) }, [task.id])

  const defOptions = definitions.map(d => ({ value: d.id, label: `${d.name} (${d.code})` }))

  const update = (index: number, patch: Partial<ParsedIndicator>) => {
    const next = items.map((it, i) => i === index ? { ...it, ...patch } : it)
    setItems(next)
    onUpdate(next)
  }

  const columns = [
    {
      title: '解析的指标名', dataIndex: 'name', key: 'name', width: 130,
      render: (v: string, r: ParsedIndicator) => (
        <Space size={4} direction="vertical" style={{ lineHeight: 1.4 }}>
          <Text strong>{v}</Text>
          {r.code && <Text type="secondary" style={{ fontSize: 11 }}>{r.code}</Text>}
        </Space>
      ),
    },
    {
      title: '解析值', key: 'val', width: 100,
      render: (_: unknown, r: ParsedIndicator) => (
        r.value != null
          ? <Text strong>{r.value} {r.unit && <Text type="secondary" style={{ fontSize: 11 }}>{r.unit}</Text>}</Text>
          : r.value_text
            ? <Text>{r.value_text}</Text>
            : <Text type="secondary">—</Text>
      ),
    },
    {
      title: '检测日期', dataIndex: 'recorded_at', key: 'date', width: 100,
      render: (v: string | null | undefined) =>
        v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>无日期</Text>,
    },
    {
      title: '匹配指标（必填）', key: 'match', width: 220,
      render: (_: unknown, r: ParsedIndicator, index: number) => (
        r.skip ? (
          <Tag color="default">已跳过</Tag>
        ) : (
          <Select
            style={{ width: '100%' }}
            size="small"
            placeholder="搜索并选择对应指标"
            showSearch
            value={r.indicator_id}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={[
              ...defOptions,
              { value: '__auto__', label: '➕ 自动创建新指标' },
            ]}
            onChange={(val) => {
              if (val === '__auto__') {
                update(index, { auto_create: true, indicator_id: undefined, matched: true })
              } else {
                update(index, { indicator_id: val, matched: true, auto_create: false })
              }
            }}
          />
        )
      ),
    },
    {
      title: '', key: 'action', width: 60,
      render: (_: unknown, r: ParsedIndicator, index: number) => (
        <Button
          type="text"
          size="small"
          danger={!r.skip}
          onClick={() => update(index, { skip: !r.skip })}
        >
          {r.skip ? '恢复' : '跳过'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      {task.parsedResult?.confidence != null && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>AI 置信度：</Text>
          <Progress
            percent={Math.round(task.parsedResult.confidence * 100)}
            size="small"
            style={{ width: 150 }}
            strokeColor={task.parsedResult.confidence > 0.7 ? '#52c41a' : '#faad14'}
          />
          {task.parsedResult.report_date && (
            <Text type="secondary" style={{ fontSize: 12 }}>报告日期：{task.parsedResult.report_date}</Text>
          )}
          {task.parsedResult.hospital && (
            <Text type="secondary" style={{ fontSize: 12 }}>医院：{task.parsedResult.hospital}</Text>
          )}
        </div>
      )}
      <Table
        dataSource={items.map((it, i) => ({ ...it, _idx: i }))}
        columns={columns}
        rowKey="_idx"
        size="small"
        pagination={false}
        scroll={{ x: 600 }}
        rowClassName={(r: ParsedIndicator & { _idx: number }) => r.skip ? 'opacity-50' : ''}
      />
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [uploading, setUploading] = useState(false)
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>([])
  const [editItems, setEditItems] = useState<Record<string, ParsedIndicator[]>>({})
  const { printRef, handlePrint } = usePrint({ title: '上传解析记录' })

  useEffect(() => {
    fetchDefinitions().then(setDefinitions).catch(console.error)
  }, [])

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  // ── 上传 ──────────────────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await uploadFile(file)
      const newTask: UploadTask = {
        id: result.id,
        name: result.file_name,
        fileType: result.file_type,
        status: 'pending',
      }
      setTasks(prev => [newTask, ...prev])
      message.success(`${file.name} 上传成功`)
    } catch (e: unknown) {
      message.error(`上传失败: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
    return false
  }

  // ── 解析 ──────────────────────────────────────────────────────────────────
  const handleAnalyze = async (taskId: string) => {
    updateTask(taskId, { status: 'processing' })
    try {
      const result = await analyzeUpload(taskId)
      if (result.status === 'done' && result.ai_parsed_json) {
        const parsed = result.ai_parsed_json as UploadTask['parsedResult']
        updateTask(taskId, { status: 'done', parsedResult: parsed })
        message.success('解析完成！请核对指标匹配后确认入库。')
      } else {
        updateTask(taskId, {
          status: 'failed',
          errorMsg: result.error_msg || '解析失败，请检查 AI 配置'
        })
        message.error(result.error_msg || '解析失败')
      }
    } catch (e: unknown) {
      updateTask(taskId, { status: 'failed', errorMsg: (e as Error).message })
      message.error(`解析失败: ${(e as Error).message}`)
    }
  }

  // ── 确认入库 ──────────────────────────────────────────────────────────────
  const handleConfirm = async (taskId: string) => {
    const items = editItems[taskId] ?? tasks.find(t => t.id === taskId)?.parsedResult?.indicators ?? []
    const toSubmit = items
      .filter(it => !it.skip)
      .map(it => ({
        name: it.name,
        code: it.code,
        value: it.value ?? null,
        value_text: it.value_text ?? null,
        unit: it.unit ?? null,
        recorded_at: it.recorded_at ?? null,
        indicator_id: it.indicator_id,
        auto_create: it.auto_create ?? false,
      }))

    try {
      const r = await confirmUpload(taskId, toSubmit)
      updateTask(taskId, {
        confirmed: true,
        importResult: { imported: r.imported, skipped: r.skipped },
      })
      message.success(r.message)
    } catch (e: unknown) {
      message.error(`入库失败: ${(e as Error).message}`)
    }
  }

  // ── 删除任务 ──────────────────────────────────────────────────────────────
  const handleDelete = async (taskId: string) => {
    try {
      await deleteUpload(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      message.success('已删除')
    } catch {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }
  }

  const ACCEPT = '.jpg,.jpeg,.png,.webp,.bmp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>上传解析</Title>
        <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>打印</Button>
      </div>

      {/* 提示 */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="使用流程"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <Steps size="small" current={-1} style={{ marginTop: 8 }}>
              <Step title="上传文件" description="支持照片/PDF/Word/Excel/TXT" />
              <Step title="AI 解析" description="点击「开始解析」调用大模型提取指标" />
              <Step title="核对匹配" description="确认每个指标对应的系统指标" />
              <Step title="确认入库" description="写入数据库，指标立即可见" />
            </Steps>
            <div style={{ marginTop: 8, color: '#6b7280' }}>
              需要在「设置」页面配置 AI 解析服务（Ollama 本地模型 或 OpenAI API）
            </div>
          </div>
        }
      />

      {/* 上传区域 */}
      <div ref={printRef}>
        <Card size="small" style={{ marginBottom: 20 }}>
          <Dragger
            name="file"
            multiple={false}
            accept={ACCEPT}
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={uploading}
            style={{ background: '#fafbff' }}
          >
            <p className="ant-upload-drag-icon">
              {uploading
                ? <Spin size="large" />
                : <InboxOutlined style={{ color: '#3b6cbf', fontSize: 48 }} />}
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '8px 0 4px' }}>
              拖拽文件到此处，或点击选择
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>
              支持：JPG / PNG / PDF / Word (.doc/.docx) / Excel (.xls/.xlsx/.csv) / TXT
            </p>
          </Dragger>
        </Card>

        {/* 任务列表 */}
        {tasks.map(task => (
          <Card
            key={task.id}
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <FileTypeIcon type={task.fileType} />
                <Text strong style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.name}
                </Text>
                <Tag color="default" style={{ fontSize: 11 }}>{task.fileType}</Tag>
                <StatusTag status={task.status} errorMsg={task.errorMsg} />
                {task.confirmed && (
                  <Tag color="success" icon={<CheckOutlined />}>已入库</Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                {task.status === 'pending' && (
                  <Button
                    type="primary" size="small" icon={<SyncOutlined />}
                    onClick={() => handleAnalyze(task.id)}
                  >
                    开始解析
                  </Button>
                )}
                {task.status === 'failed' && (
                  <Button size="small" icon={<SyncOutlined />} onClick={() => handleAnalyze(task.id)}>
                    重新解析
                  </Button>
                )}
                {task.status === 'done' && !task.confirmed && (
                  <Button
                    type="primary" size="small" icon={<CheckOutlined />}
                    onClick={() => handleConfirm(task.id)}
                  >
                    确认入库
                  </Button>
                )}
                <Popconfirm title="确认删除此上传记录？" onConfirm={() => handleDelete(task.id)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            }
          >
            {/* 解析中 */}
            {task.status === 'processing' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Spin tip="AI 解析中，请稍候…" />
              </div>
            )}

            {/* 解析失败 */}
            {task.status === 'failed' && task.errorMsg && (
              <Alert type="error" message={task.errorMsg} showIcon />
            )}

            {/* 解析结果预览 */}
            {task.status === 'done' && task.parsedResult && !task.confirmed && (
              <div>
                {(task.parsedResult.indicators?.length ?? 0) === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="未识别到任何指标"
                    description="可能是文件格式不规范，或 AI 配置有误。请检查配置后重新解析。"
                  />
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        识别到 <Text strong>{task.parsedResult.indicators.length}</Text> 项指标，
                        请核对并选择对应的系统指标后点击「确认入库」
                      </Text>
                    </div>
                    <IndicatorPreviewTable
                      task={task}
                      definitions={definitions}
                      onUpdate={(items) => setEditItems(prev => ({ ...prev, [task.id]: items }))}
                    />
                  </>
                )}
              </div>
            )}

            {/* 入库结果 */}
            {task.confirmed && task.importResult && (
              <Alert
                type="success"
                showIcon
                message={`成功写入 ${task.importResult.imported} 条指标记录`}
                description={
                  task.importResult.skipped.length > 0
                    ? `跳过 ${task.importResult.skipped.length} 条：${task.importResult.skipped.join('、')}`
                    : '所有指标已成功写入数据库'
                }
              />
            )}
          </Card>
        ))}

        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <FileOutlined style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
            <Text type="secondary">上传文件后开始解析</Text>
          </div>
        )}
      </div>
    </div>
  )
}
