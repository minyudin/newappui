import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient · 全局缓存配置
 * ============================================================
 *  分级策略 (每页按需覆盖):
 *   · 配置型 (users/orders/codes/plots...)    staleTime  2min
 *   · 状态型 (tasks/devices/screens/cameras)  staleTime  15s + refetch 30s
 *   · 实时型 (sensors/overview)               staleTime   0 + refetch 15s
 *   · 元数据 (platform-config 等)             staleTime  Infinity
 *
 *  全局默认取"配置型"值作为基线:
 *   · 同一请求 2 分钟内视为新鲜 → 切页面秒出
 *   · 5 分钟不访问回收 (gcTime)
 *   · 窗口聚焦自动 refetch (运维切回标签页看最新)
 *   · 失败重试 1 次 (对应拦截器已 toast, 不要多次重试叠 toast)
 * ============================================================ */

// 分级 staleTime 常量 · 各页面按需引入
export const STALE = {
  CONFIG:   2 * 60_000,   // 2 min · 配置型
  STATUS:   15_000,       // 15 s · 状态型
  LIVE:     0,            // 0    · 实时型 (每次都视作过期)
  STATIC:   Infinity,     // ∞    · 一次性元数据
} as const

export const REFETCH = {
  STATUS:   30_000,       // 30 s · 状态型后台轮询
  LIVE:     15_000,       // 15 s · 实时型后台轮询
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.CONFIG,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,        // 组件挂载时, 如 stale 就拉一次
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: 0, // 写操作不重试, 由调用方决定
    },
  },
})
