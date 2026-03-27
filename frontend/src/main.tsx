import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import './index.css'

dayjs.locale('zh-cn')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#3b6cbf',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
          fontSize: 14,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f5f7fa',
        },
        components: {
          Menu: {
            darkItemBg: '#1a1a2e',
            darkSubMenuItemBg: '#12122a',
            darkItemSelectedBg: '#3b6cbf',
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#374151',
            rowHoverBg: '#f0f4ff',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
