import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import type { RoleType } from '@/types'

/**
 * G2 · useRequireRole
 * ============================================================
 *  把 4+ 个页面里手写的 "如果 roleType 不是 X 就 switchTab 走" 角色守卫抽成 hook.
 *
 *  背景 (M6 guest 修复过程中暴露):
 *    adoptions / ai-chat / ai-assist / operator-workbench 各自手写 roleType 判断,
 *    逻辑分散. 每加一个新角色 (如 guest) 都要在 N 个文件里改同一件事, 容易漏.
 *    抽成 hook 后角色矩阵只有一个来源 (LANDING_OF), 改动集中.
 *
 *  守卫规则:
 *    1. 无 token        → redirectTo /pages/login/index
 *    2. roleType 匹配   → 放行
 *    3. roleType 不匹配 → 按角色 switchTab 到各自 landing page
 *                         (preferNavigateBack 为 true 时先试 navigateBack)
 *
 *  用法:
 *    useRequireRole('adopter')                           // 单角色
 *    useRequireRole(['adopter', 'guest'])                // 多角色 allow-list
 *    useRequireRole(['adopter', 'guest'], { preferNavigateBack: true })
 *      // 非 tabBar 的内页 (如 ai-chat 从 plot 跳进来), 优先 navigateBack 回源.
 *
 *  生命周期挂载点: useLoad + useDidShow 同时跑一次, 登出/换号后 tabBar 切回也能兜住.
 * ============================================================ */

/** 角色 → landing page 的单一来源. 加/改角色只改这里 */
const LANDING_OF: Record<RoleType, string> = {
  adopter: '/pages/adoptions/index',
  operator: '/pages/operator-workbench/index',
  guest: '/pages/me/index',
  admin: '/pages/me/index',
  agronomist: '/pages/me/index',
  ai_agent: '/pages/me/index',
  edge_node: '/pages/me/index',
}

export interface UseRequireRoleOptions {
  /**
   * 角色不匹配时优先尝试 navigateBack (页面栈非空时退回上一页),
   * 失败才 fallback 到角色 landing. 适用于非 tabBar 的内页 (如 ai-chat).
   * 默认 false · 直接 switchTab 到 landing.
   */
  preferNavigateBack?: boolean

  /**
   * 是否强制要求 user.bindNickname=true.
   * 默认 true · 设为 false 跳过此检查 (如 setup-nickname 页本身, share-codes 等).
   * 微信新用户登录后 bindNickname=false, 必须先去 /pages/setup-nickname 设置才能进业务.
   */
  requireBindNickname?: boolean
}

export function useRequireRole(
  allowed: RoleType | RoleType[],
  options: UseRequireRoleOptions = {},
) {
  const allowList = Array.isArray(allowed) ? allowed : [allowed]
  const preferNavigateBack = options.preferNavigateBack ?? false
  const requireBindNickname = options.requireBindNickname ?? true

  function enforce() {
    const state = useAuthStore.getState()

    // 1. 无 token → 登录页
    if (!state.token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }

    const role = state.userInfo?.roleType
    // 2. 角色匹配 → 检查昵称, 通过则放行
    if (role && allowList.includes(role)) {
      // adopter / operator / agronomist 必须设过昵称才能进业务页;
      // guest 角色是分享码临时身份, 用"游客XXXXXX" 自动昵称即可不强制.
      const isGuest = role === 'guest'
      if (requireBindNickname && !isGuest && state.userInfo?.bindNickname === false) {
        Taro.redirectTo({ url: '/pages/setup-nickname/index' }).catch(() =>
          Taro.reLaunch({ url: '/pages/setup-nickname/index' }),
        )
        return
      }
      return
    }

    // 3. 角色为空 (异常) → 兜到登录
    if (!role) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }

    // 4. 角色不匹配 → 去该角色的 landing page
    const landing = LANDING_OF[role] || '/pages/login/index'
    if (preferNavigateBack) {
      Taro.navigateBack().catch(() => {
        Taro.switchTab({ url: landing }).catch(() =>
          Taro.redirectTo({ url: landing }),
        )
      })
    } else {
      Taro.switchTab({ url: landing }).catch(() =>
        Taro.redirectTo({ url: landing }),
      )
    }
  }

  useLoad(() => {
    enforce()
  })

  useDidShow(() => {
    enforce()
  })
}
