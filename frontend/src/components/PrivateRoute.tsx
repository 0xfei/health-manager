import { Navigate } from 'react-router-dom'

interface Props {
  children: React.ReactNode
}

/** 路由守卫：没有 token 时跳转到登录页 */
export default function PrivateRoute({ children }: Props) {
  const token = localStorage.getItem('hm_access_token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
