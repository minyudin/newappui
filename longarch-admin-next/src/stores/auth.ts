import { create } from 'zustand'
import type { UserInfo } from '@/types/api'

/**
 * Auth Store · Zustand (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  · Token 已迁移到 HttpOnly cookie (由后端 Sa-Token 下发)
 *    → JS 完全读不到 token, 从根上挡 XSS 窃取
 *  · 本 store 只存内存态:
 *      - userInfo     当前登录用户画像 (来自 POST /auth/admin-login 或 GET /users/me)
 *      - bootstrapped 启动引导完成标记 (避免未探测完就把用户踢到 /login)
 *  · 没有 persist: 刷新页面会重新调 /users/me 探测 session
 *  · logout() 仅清内存, 真正的登出 (擦 cookie) 由 POST /auth/logout 后端完成
 * ============================================================ */

interface AuthState {
  userInfo: UserInfo | null
  /** 启动引导是否完成 · RouteGuard 据此区分"还没探测"和"已确认未登录" */
  bootstrapped: boolean
  setUserInfo: (info: UserInfo | null) => void
  setBootstrapped: (b: boolean) => void
  /** 仅清本地状态; 真正登出需再调 POST /auth/logout 擦 cookie */
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  userInfo: null,
  bootstrapped: false,
  setUserInfo: (info) => set({ userInfo: info }),
  setBootstrapped: (b) => set({ bootstrapped: b }),
  logout: () => set({ userInfo: null }),
}))
