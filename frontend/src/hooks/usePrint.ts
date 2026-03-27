import { useCallback, useRef } from 'react'

/**
 * usePrint — 打印页面指定区域
 * 使用方式：
 *   const { printRef, handlePrint } = usePrint({ title: '健康总览' })
 *   <div ref={printRef}>...内容...</div>
 *   <Button onClick={handlePrint}>打印</Button>
 */
export interface UsePrintOptions {
  title?: string
  extraStyles?: string
}

export function usePrint(options: UsePrintOptions = {}) {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useCallback(() => {
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      window.print()
      return
    }

    const title = options.title || document.title
    const html = content.innerHTML

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
        'Microsoft YaHei', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #fff;
      padding: 20px 28px;
    }
    h1, h2, h3, h4, h5 { font-weight: 600; color: #1a1a2e; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d9e0; padding: 6px 10px; font-size: 12px; }
    th { background: #f0f4fa; font-weight: 600; text-align: left; }
    .ant-card { border: 1px solid #d1d9e0; border-radius: 8px; margin-bottom: 16px; padding: 12px 16px; }
    .ant-card-head { border-bottom: 1px solid #e8edf4; padding-bottom: 8px; margin-bottom: 12px; }
    .ant-tag { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 11px; border: 1px solid currentColor; }
    .ant-badge-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
    .ant-badge-status-success .ant-badge-status-dot { background: #52c41a; }
    .ant-badge-status-error .ant-badge-status-dot { background: #ff4d4f; }
    .ant-badge-status-warning .ant-badge-status-dot { background: #faad14; }
    .ant-statistic-title { font-size: 12px; color: #6b7280; }
    .ant-statistic-content { font-size: 22px; font-weight: 700; }
    .print-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 20px; border-bottom: 2px solid #3b6cbf; }
    .print-date { font-size: 11px; color: #6b7280; }
    .no-print { display: none !important; }
    /* 状态颜色 */
    .status-normal  { color: #52c41a; }
    .status-warning { color: #faad14; }
    .status-danger  { color: #ff4d4f; }
    /* 图表区域 */
    .echarts-for-react, canvas { max-width: 100%; }
    /* 强制背景色打印 */
    .profile-card-bg { background: #f0f6ff !important; }
    ${options.extraStyles || ''}
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <div style="font-size:18px;font-weight:700;color:#1a1a2e;">SLE 健康管理系统</div>
      <div style="font-size:12px;color:#6b7280;">${title}</div>
    </div>
    <div class="print-date">打印时间：${new Date().toLocaleString('zh-CN')}</div>
  </div>
  ${html}
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`)
    printWindow.document.close()
  }, [options.title, options.extraStyles])

  return { printRef, handlePrint }
}
