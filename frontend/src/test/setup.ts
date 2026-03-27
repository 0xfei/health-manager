/**
 * Vitest 全局测试环境初始化
 * - 引入 @testing-library/jest-dom 扩展断言
 * - Mock echarts（避免 canvas 报错）
 * - Mock axios（隔离 API 请求）
 */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock echarts-for-react（canvas 在 jsdom 不可用）
vi.mock('echarts-for-react', () => ({
  default: () => null,
}))

// Mock echarts core
vi.mock('echarts', () => ({
  init: vi.fn(),
  registerMap: vi.fn(),
}))

// Mock ResizeObserver（Ant Design 需要）
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
