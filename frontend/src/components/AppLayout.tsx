import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu, Badge, Typography, Space } from 'antd'
import {
  DashboardOutlined, ExperimentOutlined, MedicineBoxOutlined,
  HeartOutlined, FileTextOutlined, CalendarOutlined,
  CloudUploadOutlined, SettingOutlined, AlertOutlined,
} from '@ant-design/icons'

const { Text } = Typography

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '健康总览' },
  { key: '/indicators', icon: <ExperimentOutlined />, label: '检验指标' },
  { key: '/aps', icon: <AlertOutlined />, label: 'APS · 抗凝' },
  { key: '/symptoms', icon: <HeartOutlined />, label: '症状记录' },
  { key: '/medications', icon: <MedicineBoxOutlined />, label: '用药记录' },
  { key: '/visits', icon: <CalendarOutlined />, label: '就诊记录' },
  { key: '/upload', icon: <CloudUploadOutlined />, label: '上传解析' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeKey = '/' + location.pathname.split('/')[1]

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Space direction="vertical" size={2}>
            <Text style={{ color: '#fff', fontWeight: 700, fontSize: 16, display: 'block' }}>
              🩺 健康管理
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
              SLE + APS 专项追踪
            </Text>
          </Space>
        </div>

        {/* Nav */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, borderRight: 'none', background: 'transparent', marginTop: 8 }}
          items={menuItems}
        />

        {/* Version */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>v0.1.0 · 本地运行</Text>
        </div>
      </aside>

      {/* Main */}
      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
