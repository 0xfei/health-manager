import { useState } from 'react'
import {
  Card, Upload, Button, Typography, Table, Tag, Space, message, Spin,
} from 'antd'
import { InboxOutlined, DeleteOutlined } from '@ant-design/icons'
import { uploadFile } from '../../api'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

interface UploadedFile {
  uid: string
  name: string
  status: string
  id?: string
}

export default function UploadPage() {
  const [fileList, setFileList] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const result = await uploadFile(file)
      setFileList(prev => [...prev, {
        uid: result.id,
        name: result.file_name,
        status: result.status,
        id: result.id,
      }])
      message.success(`${file.name} 上传成功`)
    } catch (e: unknown) {
      message.error((e as Error).message)
    } finally {
      setUploading(false)
    }
    return false
  }

  const columns = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { pending: 'default', processing: 'processing', done: 'success', failed: 'error' }
        return <Tag color={map[v] ?? 'default'}>{v}</Tag>
      },
    },
    {
      title: '', key: 'action', width: 60,
      render: (_: unknown, r: UploadedFile) => (
        <Button
          type="text" danger icon={<DeleteOutlined />} size="small"
          onClick={() => setFileList(prev => prev.filter(f => f.uid !== r.uid))}
        />
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 20 }}>上传解析</Title>

      <Card size="small" style={{ marginBottom: 20 }}>
        <Dragger
          name="file"
          multiple={false}
          accept=".jpg,.jpeg,.png,.webp,.bmp,.pdf,.txt"
          beforeUpload={handleUpload}
          showUploadList={false}
          disabled={uploading}
          style={{ background: '#fafbff' }}
        >
          <p className="ant-upload-drag-icon">
            {uploading ? <Spin size="large" /> : <InboxOutlined style={{ color: '#3b6cbf', fontSize: 48 }} />}
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: '8px 0 4px' }}>
            拖拽文件到此处，或点击选择文件
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            支持格式：JPG / PNG / PDF / TXT　·　化验单截图、报告扫描件均可
          </p>
        </Dragger>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <span>已上传文件</span>
            <Tag>{fileList.length}</Tag>
          </Space>
        }
      >
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
          <Text style={{ fontSize: 12, color: '#92400e' }}>
            💡 <strong>AI 解析功能</strong>需要配置 OpenAI API Key 或本地 Ollama 模型，请前往「设置」页面配置后使用。
            上传后文件保存在本地 <code>data/uploads/</code> 目录。
          </Text>
        </div>
        <Table
          dataSource={fileList}
          columns={columns}
          rowKey="uid"
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无上传文件' }}
        />
      </Card>
    </div>
  )
}
