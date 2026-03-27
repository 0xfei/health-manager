import axios from 'axios'

// 生产环境使用环境变量，开发环境走 vite proxy（/api → 127.0.0.1:8000）
// vite 构建时会通过 VITE_API_BASE_URL env 注入；未设置则默认 /api（走 Nginx 反代）
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

// 请求拦截器：自动附加 Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hm_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 时清除 token 并跳转登录页
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hm_access_token')
      // 避免在登录页死循环
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    const msg = err.response?.data?.detail || err.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export default api
