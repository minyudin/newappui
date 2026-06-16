import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setHttpNavigate } from '@/api'

/**
 * NavigateBridge · 注入 navigate 到 http 拦截器
 * ============================================================
 *  React 没有全局 router 实例, 需要在 BrowserRouter 内部把
 *  useNavigate 的返回值通过 setHttpNavigate 注册给 http.ts
 *  这样 code === 40002 时拦截器可以调 navigate('/login')
 *
 *  组件只需要挂一次, 不渲染任何 DOM
 * ============================================================ */
export default function NavigateBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    setHttpNavigate((path: string) => navigate(path))
  }, [navigate])

  return null
}
