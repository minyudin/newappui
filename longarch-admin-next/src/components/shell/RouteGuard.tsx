import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/stores/auth'

interface RouteGuardProps {
  children: ReactNode
}

/**
 * RouteGuard · 登录守卫 (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  三态判断:
 *    · bootstrapped=false            启动引导未完成  → 渲染 null (等探测)
 *    · bootstrapped=true + userInfo  已登录          → 渲染 children
 *    · bootstrapped=true + 无 userInfo 未登录/已过期  → 重定向到 /login
 *  避免硬刷新时把用户瞬间踢到 /login
 * ============================================================ */
export default function RouteGuard({ children }: RouteGuardProps) {
  const userInfo = useAuthStore((s) => s.userInfo)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const location = useLocation()

  if (!bootstrapped) {
    // 启动引导中: 后端 /users/me 探测未完成, 不做任何决定
    // 空白帧很短, 不闪, 比跳 /login 再跳回来体验好
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6">
        <section className="border border-line bg-paper-light px-8 py-7 text-center">
          <div className="font-folio text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            § BOOTSTRAP · ADMIN
          </div>
          <div className="mt-3 font-serif text-[22px] leading-tight text-ink">
            正在连接管理后台
          </div>
          <div className="mt-2 font-sans text-[12px] text-ink-soft">
            正在加载用户信息…
          </div>
        </section>
      </main>
    )
  }
  if (!userInfo) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}
