import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/lib/toast'
import type { ApiEnvelope } from '@/types/api'

/**
 * http · axios 实例 (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  契约:
 *   · baseURL            /api/v1
 *   · timeout            15000 ms
 *   · withCredentials    true ─ 允许请求携带 cookie
 *   · 无 Authorization   Token 不再经 JS 传递, 完全隔离 XSS
 *   · 响应 code === 0    自动脱壳返回 data.data
 *   · 响应 code === 40002 logout(store) + navigate('/login') + toast('登录已过期')
 *   · 其他 code          toast(message) + reject
 *   · 网络错误           toast(err.message) + reject
 *
 *  React 没有全局 router 实例, 用 setHttpNavigate 注入 navigate 函数
 * ============================================================ */

// ---- 导航注入 (由上层组件通过 setHttpNavigate 注册) ----
let navigateFn: ((path: string) => void) | null = null
export function setHttpNavigate(fn: (path: string) => void) {
  navigateFn = fn
}

// ---- axios 实例 ----
// withCredentials=true: 允许请求携带 cookie (Vite dev 同源代理, 生产同域亦无负担)
const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true,
})

// ---- 请求拦截器: cookie 自动携带, 无需额外工作 ----
// 保留一个空的拦截器以便将来需要挂请求级别 metadata (如 traceId)
http.interceptors.request.use((config: InternalAxiosRequestConfig) => config)

// ---- 响应拦截器: 脱壳 + 登录过期处理 ----
http.interceptors.response.use(
  // 注意: 此处泛型 T 是包络里 data 的类型, 返回给调用方的是脱壳后的 data
  // 使用 unknown 表示"由调用方 cast 或通过函数签名约束"
  (res: AxiosResponse<ApiEnvelope<unknown>>) => {
    const envelope = res.data

    if (envelope.code === 0) {
      // 脱壳: 直接返回 data.data, 让调用方 await 到业务数据本身
      // TypeScript 这里用 as unknown 规避 AxiosResponse 泛型约束
      return envelope.data as unknown as AxiosResponse
    }

    if (envelope.code === 40002) {
      useAuthStore.getState().logout()
      // 已经在 /login 上 (含启动引导探测), 不再 toast + 自跳, 避免"登录已过期"误导未登录用户
      const onLoginPage =
        typeof window !== 'undefined' && window.location.pathname === '/login'
      if (!onLoginPage) {
        navigateFn?.('/login')
        toast.error('登录已过期，请重新登录')
      }
      return Promise.reject(new Error(envelope.message))
    }

    toast.error(envelope.message || '请求失败')
    return Promise.reject(new Error(envelope.message))
  },
  (err: AxiosError) => {
    toast.error(err.message || '网络异常')
    return Promise.reject(err)
  },
)

export default http
