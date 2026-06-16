import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { TAB_BAR_SYNC_EVT } from './events'
import { useAuthStore } from '@/store/auth'
import './index.scss'

/**
 * Custom TabBar · Folio 风
 * ============================================================
 *  位置: src/custom-tab-bar/index.tsx (Taro 约定路径)
 *  当 app.config.ts 的 tabBar.custom === true 时自动启用
 *
 *  设计原则:
 *    · 纯 hairline · 无圆角 · 无阴影
 *    · § 编号 + 衬线字
 *    · 选中项墨色, 未选次级灰
 *
 *  转场动效 (重构 v2):
 *    · 只在源 tab 实例上一次性显示, 不再跨页接力 (旧版 storage relay 已删)
 *    · 固定 750ms · 单一定时器, 时序稳定
 *    · 不回滚 selected (switchTab 失败概率极低, 失败由 tabBar 同步事件兜底)
 * ============================================================ */

interface TabItem {
  pagePath: string
  text: string
  seal: string
}

function getVisibleTabs(roleType: string | undefined | null): TabItem[] {
  // operator: 首页 / 工作台 / AI / 我的 (4 个 · 工作台高频, 单独留一席)
  if (roleType === 'operator') {
    return [
      { pagePath: '/pages/home/index', text: '首页', seal: '§ 00' },
      { pagePath: '/pages/operator-workbench/index', text: '工作台', seal: '§ 01' },
      { pagePath: '/pages/ai-assist/index', text: 'AI询问', seal: '§ 02' },
      { pagePath: '/pages/me/index', text: '我的', seal: '§ 03' },
    ]
  }
  // M6 · guest 是分享码进入的临时用户: 没有认养订单, AI 询问也用不到.
  //      只留 "我的" 作为身份 / 退出入口
  if (roleType === 'guest') {
    return [
      { pagePath: '/pages/me/index', text: '我的', seal: '§ 01' },
    ]
  }
  // adopter / agronomist / admin: 首页 / 认养 / AI / 我的
  return [
    { pagePath: '/pages/home/index', text: '首页', seal: '§ 00' },
    { pagePath: '/pages/adoptions/index', text: '认养', seal: '§ 01' },
    { pagePath: '/pages/ai-assist/index', text: 'AI询问', seal: '§ 02' },
    { pagePath: '/pages/me/index', text: '我的', seal: '§ 03' },
  ]
}

const TRANSITION_MS = 750

// 挂载前就算出当前选中, 避免 "先 selected=0, useEffect 后再跳 idx" 的首帧闪烁
function computeInitialSelected(tabs: TabItem[]): number {
  try {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    if (!current) return 0
    const path = `/${(current as { route?: string }).route || ''}`
    const idx = tabs.findIndex((t) => t.pagePath === path)
    return idx >= 0 ? idx : 0
  } catch {
    return 0
  }
}

export default function CustomTabBar() {
  const roleType = useAuthStore((s) => s.userInfo?.roleType)
  const tabs = getVisibleTabs(roleType)

  const [selected, setSelected] = useState<number>(() => computeInitialSelected(tabs))
  const [showTransition, setShowTransition] = useState(false)
  const [transitionTitle, setTransitionTitle] = useState('')
  const [transitionSeal, setTransitionSeal] = useState('')
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTransitionTimer() {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }

  // 同步 selected:
  //  · mount 时按 path 算一次
  //  · 订阅 tab 页 useDidShow 发的 path 事件 (最可靠 · 用户从非 tab 页 navigateBack 也准)
  //  · roleType 切换 (登录 / 登出 / 换号) 时按 path 重算
  useEffect(() => {
    const fresh = computeInitialSelected(tabs)
    setSelected((prev) => (prev === fresh ? prev : fresh))

    const handler = (payload: unknown) => {
      if (typeof payload === 'string') {
        const idx = tabs.findIndex((t) => t.pagePath === payload)
        if (idx >= 0) setSelected((prev) => (prev === idx ? prev : idx))
        return
      }
      if (typeof payload === 'number') {
        if (payload < 0 || payload >= tabs.length) return
        setSelected((prev) => (prev === payload ? prev : payload))
      }
    }
    Taro.eventCenter.on(TAB_BAR_SYNC_EVT, handler)

    return () => {
      Taro.eventCenter.off(TAB_BAR_SYNC_EVT, handler)
      clearTransitionTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleType])

  function handleTap(idx: number) {
    if (idx === selected) return

    const target = tabs[idx]
    // 1. 立即视觉反馈: 选中态 + 转场遮罩
    setSelected(idx)
    setTransitionTitle(target.text)
    setTransitionSeal(target.seal)
    setShowTransition(true)

    // 2. 单一定时器 · 750ms 后必收起 (即使 switchTab 失败也不会卡死)
    clearTransitionTimer()
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null
      setShowTransition(false)
    }, TRANSITION_MS)

    // 3. 异步切页 · 失败时由 tabBar 同步事件 (TAB_BAR_SYNC_EVT) 修正 selected
    Taro.switchTab({ url: target.pagePath }).catch(() => {
      Taro.redirectTo({ url: target.pagePath }).catch(() => {
        // 双失败: 立即收转场, 让用户看清楚 (但保留当前 selected, 由后续 sync 事件矫正)
        clearTransitionTimer()
        setShowTransition(false)
      })
    })
  }

  return (
    <>
      {showTransition ? (
        <View className='tab-transition' aria-hidden>
          <View className='tab-transition__inner'>
            <View className='tab-transition__ring'>
              <View className='tab-transition__ring-outer' />
              <View className='tab-transition__ring-inner' />
            </View>
            <View className='tab-transition__mark'>
              <Text className='tab-transition__mark-chapter'>{transitionSeal}</Text>
              <Text className='tab-transition__mark-sep'>·</Text>
              <Text className='tab-transition__mark-title'>{transitionTitle}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View className='tab-bar'>
        {tabs.map((tab, idx) => {
          const active = idx === selected
          return (
            <View
              key={tab.pagePath}
              className={`tab-bar__item ${active ? 'tab-bar__item--active' : ''}`}
              onClick={() => handleTap(idx)}
            >
              <Text className='tab-bar__seal'>{tab.seal}</Text>
              <Text className='tab-bar__label'>{tab.text}</Text>
            </View>
          )
        })}
      </View>
    </>
  )
}
