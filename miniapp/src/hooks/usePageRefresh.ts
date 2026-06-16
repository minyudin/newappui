import { useLoad, useDidShow } from '@tarojs/taro'
import { useRef } from 'react'

/**
 * G1 · usePageRefresh
 * ============================================================
 *  把 10+ 个页面里重复的 "useLoad + useDidShow + isFirstShowRef 跳首次" 样板抽成 hook.
 *
 *  背景:
 *    Taro 小程序生命周期里, 首次挂载会 onLoad → onShow 紧贴着各触发一次.
 *    若 useLoad 和 useDidShow 都调同一个 refresh, 会有两次并发 API 请求.
 *    通用解法 · 在 useDidShow 里用 ref 跳过首次, 之后每次 show 才 refresh.
 *
 *  用法:
 *    usePageRefresh(refreshAll)                 // 默认跳过首次 show
 *    usePageRefresh(refreshAll, { skipFirstShow: false })  // 首次也要 refresh
 *
 *  注意:
 *    refresh 函数内部应自行处理 token / 参数缺失等早退条件.
 *    Hook 不替代业务层的守卫; 组合使用 useRequireRole 做角色闸门.
 * ============================================================ */

export interface UsePageRefreshOptions {
  /** 是否跳过首次 useDidShow (紧跟 useLoad 的那次), 默认 true */
  skipFirstShow?: boolean
}

export function usePageRefresh(
  refresh: () => void,
  options: UsePageRefreshOptions = {},
) {
  const skipFirstShow = options.skipFirstShow ?? true
  const firstShowRef = useRef(skipFirstShow)

  useLoad(() => {
    refresh()
  })

  useDidShow(() => {
    if (firstShowRef.current) {
      firstShowRef.current = false
      return
    }
    refresh()
  })
}
