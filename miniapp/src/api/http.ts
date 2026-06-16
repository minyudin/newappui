import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import type { ApiEnvelope } from '@/types'

/**
 * HTTP Client · Miniapp
 * ============================================================
 *  - 基座: Taro.request (底层是 wx.request)
 *  - Base URL: 构建期 defineConstants 注入 TARO_APP_API_BASE
 *  - 认证: header `satoken: <token>` (从 zustand store 拿)
 *  - 统一脱壳: 只返回 envelope.data, 非 0 统一 toast + throw
 *  - 40002 登录失效: 清 auth + redirect /login
 * ============================================================ */

const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:8081/api/v1'

// G3 · 40002 并发重定向锁 · promise 版本
//   场景: plot 页 Promise.all([5 个接口]) 在 token 失效时会同时 40002,
//         若每一路都执行 redirectTo + toast, 会看到 5 次 toast 堆叠 +
//         4 次 redirectTo 失败 (只有第一次能跳).
//
//   旧版 (boolean + 500ms 定时器复位) 问题:
//     · redirectTo 在真机可能 > 500ms, 锁先复位 → 新请求回来后又跳一次
//     · HMR 场景模块级变量不一定重置, 调试 40002 时状态诡异
//     · 500ms 是拍脑袋常数, 没有信号告诉系统跳完了
//
//   新版: 用 Promise 承载完整的 redirect 生命周期, 锁的生命周期和真实导航完成 1:1 对齐.
//     第一个 40002 进来就把 pendingRedirect 设成进行中的 Promise, 后续并发 40002
//     进来发现非 null 直接跳过 toast + redirect, 等真正完成后 finally 里清 null.
let pendingRedirect: Promise<void> | null = null

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: unknown
  header?: Record<string, string>
  /** true: 40002 时不自动 toast + redirect (用于登录页自己处理) */
  silent?: boolean
}

export async function request<T = unknown>({
  url,
  method = 'GET',
  data,
  header = {},
  silent = false,
}: RequestOptions): Promise<T> {
  const token = useAuthStore.getState().token

  // N55 · Taro.request 在网络异常时 reject 一个 { errMsg } 对象,
  //       而不是 Error 实例, 会让上层的 `e instanceof Error` 判断失败,
  //       错误信息退化为 "加载失败" 之类的兜底文案. 这里包一层规范化.
  // N56 · 小程序 wx.request 默认 timeout 60s, 对移动端 UX 过长; 显式收到 15s
  let res: Taro.request.SuccessCallbackResult<ApiEnvelope<T>>
  try {
    res = await Taro.request<ApiEnvelope<T>>({
      url: `${API_BASE}${url}`,
      method,
      data: data as never,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'miniapp',
        ...(token ? { satoken: token } : {}),
        ...header,
      },
    })
  } catch (raw) {
    // wx 原生失败对象: { errMsg: 'request:fail timeout' 等 }
    const errMsg = (raw as { errMsg?: string } | null | undefined)?.errMsg || ''
    const isTimeout = /timeout/i.test(errMsg)
    const friendly = isTimeout ? '网络请求超时, 请检查网络' : '网络异常, 请稍后重试'
    if (!silent) {
      Taro.showToast({ title: friendly, icon: 'none' })
    }
    console.warn('[http] network error · url=', url, 'errMsg=', errMsg)
    throw new Error(friendly)
  }

  // HTTP 层非 2xx 直接抛
  if (res.statusCode < 200 || res.statusCode >= 300) {
    // N94 · 401/403 是认证错误, 后续业务层可能还会处理 (如 40002), 避免重复 toast
    const isAuthError = res.statusCode === 401 || res.statusCode === 403
    if (!silent && !isAuthError) {
      Taro.showToast({ title: `网络异常 ${res.statusCode}`, icon: 'none' })
    }
    throw new Error(`HTTP ${res.statusCode}`)
  }

  const envelope = res.data

  if (envelope.code === 0) {
    return envelope.data
  }

  if (envelope.code === 40002) {
    // 登录失效, 清态 + 回登录
    console.warn('[http] 40002 登录失效 · url=', url, 'msg=', envelope.message)
    useAuthStore.getState().clearAuth()
    // G3 · Promise 锁: 并发下只触发一次 UI 反馈 + 一次 redirect
    //   后续并发 40002 发现 pendingRedirect 非 null 直接跳过,
    //   锁在真实 navigation 完成的 finally 里才释放 (不再依赖猜测的 500ms 窗口).
    if (!silent && !pendingRedirect) {
      Taro.showToast({ title: '登录已过期, 请重新登录', icon: 'none' })
      pendingRedirect = (async () => {
        try {
          await Taro.redirectTo({ url: '/pages/login/index' })
        } catch {
          // 已经在 /login 上 redirectTo 会失败, 兜 reLaunch (reLaunch 在 /login 上也幂等)
          try {
            await Taro.reLaunch({ url: '/pages/login/index' })
          } catch {
            // 极端情况下两者都失败 (页面栈异常), 静默吞掉, 下次请求仍走此逻辑
          }
        } finally {
          pendingRedirect = null
        }
      })()
    }
    throw new Error(envelope.message || '登录已过期')
  }

  if (!silent) {
    Taro.showToast({ title: envelope.message || '请求失败', icon: 'none' })
  }
  throw new Error(envelope.message || '请求失败')
}
