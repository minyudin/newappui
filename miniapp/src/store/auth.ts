import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { UserInfo } from '@/types'

/**
 * Auth Store · Miniapp
 * ============================================================
 *  - 小程序没有 HttpOnly cookie 的便利, token 存本地 Storage
 *  - 请求头走 `satoken: <token>` (Sa-Token token-name=satoken, token-prefix="")
 *  - 与 admin-next 统一的 userInfo 结构
 * ============================================================ */

const TOKEN_KEY = 'satoken'
const USER_KEY = 'userinfo'

interface AuthState {
  token: string | null
  userInfo: UserInfo | null
  setAuth: (token: string, userInfo: UserInfo) => void
  setUserInfo: (userInfo: UserInfo) => void
  clearAuth: () => void
  hydrate: () => void
}

// N10 · Storage 操作可能失败 (用户禁用/清数据/空间满), 统一吞掉异常不传播到 UI
function safeSet(key: string, value: unknown) {
  try {
    Taro.setStorageSync(key, value)
  } catch (e) {
    console.warn('[auth] setStorage failed', key, e)
  }
}

function safeRemove(key: string) {
  try {
    Taro.removeStorageSync(key)
  } catch (e) {
    console.warn('[auth] removeStorage failed', key, e)
  }
}

function safeGet<T>(key: string): T | null {
  try {
    const v = Taro.getStorageSync(key)
    return (v as T) || null
  } catch (e) {
    console.warn('[auth] getStorage failed', key, e)
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userInfo: null,

  setAuth: (token, userInfo) => {
    safeSet(TOKEN_KEY, token)
    safeSet(USER_KEY, userInfo)
    set({ token, userInfo })
  },

  setUserInfo: (userInfo) => {
    safeSet(USER_KEY, userInfo)
    set({ userInfo })
  },

  clearAuth: () => {
    safeRemove(TOKEN_KEY)
    safeRemove(USER_KEY)
    // 注意: 刻意不清 stub_device_id, 它是设备身份锚点, 要在 logout 后保留
    //       以便下次登录回到同一个 userId (参考 pages/login/index.tsx 注释)
    set({ token: null, userInfo: null })
  },

  hydrate: () => {
    const token = safeGet<string>(TOKEN_KEY)
    const userInfo = safeGet<UserInfo>(USER_KEY)
    set({ token, userInfo })
  },
}))
