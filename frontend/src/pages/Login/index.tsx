import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Typography, Space, Alert, message } from 'antd'
import { LockOutlined, HeartOutlined } from '@ant-design/icons'
import api from '../../api/client'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null)

  // 检查服务器是否启用了认证
  useEffect(() => {
    api.get('/auth/check').then(r => {
      setAuthEnabled(r.data.auth_enabled)
      // 如果认证未启用，直接写入占位 token 并跳转
      if (!r.data.auth_enabled) {
        localStorage.setItem('hm_access_token', '__no_auth__')
        window.location.href = '/'
      }
    }).catch(() => {
      setAuthEnabled(true) // 接口异常时要求登录
    })
  }, [])

  async function handleLogin(vals: { token: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { token: vals.token })
      if (res.data.ok) {
        localStorage.setItem('hm_access_token', res.data.access_token)
        message.success('登录成功')
        window.location.href = '/'
      } else {
        setError(res.data.message || 'Token 错误')
      }
    } catch (e: unknown) {
      setError((e as Error).message || '登录失败，请检查网络')
    } finally {
      setLoading(false)
    }
  }

  if (authEnabled === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Text type="secondary">正在连接服务…</Text>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f0fe 0%, #f5f5f5 100%)',
    }}>
      <Card
        style={{ width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', borderRadius: 16 }}
        bodyStyle={{ padding: '40px 36px' }}
      >
        {/* Logo */}
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b6cbf 0%, #52c41a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HeartOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>健康管理系统</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>SLE + APS 专项追踪</Text>
        </Space>

        {error && (
          <Alert
            type="error"
            message={error}
            style={{ marginBottom: 16 }}
            showIcon
            closable
            onClose={() => setError('')}
          />
        )}

        <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
          <Form.Item
            name="token"
            rules={[{ required: true, message: '请输入访问密钥' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="请输入访问密钥"
              size="large"
              autoFocus
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              进入系统
            </Button>
          </Form.Item>
        </Form>

        <Text
          type="secondary"
          style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 20 }}
        >
          本系统仅供个人医疗数据追踪使用
        </Text>
      </Card>
    </div>
  )
}
