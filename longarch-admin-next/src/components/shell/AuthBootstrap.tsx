import { useEffect, type ReactNode } from 'react'
import { getCurrentUser } from '@/api'
import { useAuthStore } from '@/stores/auth'

interface AuthBootstrapProps {
  children: ReactNode
}

/**
 * AuthBootstrap · 启动引导 (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  Token 已迁移到 HttpOnly cookie, JS 无法读取 → 无法直接判断"是否登录"
 *  解法: 挂载时一次性探测 GET /users/me
 *    · 200 → setUserInfo(data)
 *    · 40002 / 401 / 网络失败 → 保持 userInfo=null (= 未登录)
 *    · 无论成败, 最后 setBootstrapped(true), 让 RouteGuard 解除等待
 *
 *  组件不渲染任何 DOM, 仅副作用, 放在 <BrowserRouter> 内 <Routes> 外
 *  保证 /login 与 /* 两个分支都共享同一个引导结果
 * ============================================================ */
export default function AuthBootstrap({ children }: AuthBootstrapProps) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const setUserInfo = useAuthStore((s) => s.setUserInfo)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)

  useEffect(() => {
    if (bootstrapped) return
    let cancelled = false
    getCurrentUser()
      .then((user) => {
        if (!cancelled && user) setUserInfo(user)
      })
      .catch(() => {
        // 未登录 / cookie 过期 / 网络失败 都按"未登录"处理
        // 响应拦截器遇 40002 也会调 logout() 清 userInfo, 这里无需再写
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true)
      })
    return () => {
      cancelled = true
    }
  }, [bootstrapped, setUserInfo, setBootstrapped])

  return <>{children}</>
}
