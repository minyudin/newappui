import { PropsWithChildren, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useLaunch } from '@tarojs/taro'
import { useAuthStore } from '@/store/auth'
import { applySeasonTheme } from '@/lib/solar-terms'
import FolioCorners from '@/components/FolioCorners'
import './app.scss'

/**
 * Taro 4 · React 入口
 * ============================================================
 *  onLaunch: 从 Storage hydrate auth store, 让每个页面 mount 时已经拿到
 *  token / userInfo (如果之前登过)
 * ============================================================ */
function App({ children }: PropsWithChildren) {
  const [showModuleTransition, setShowModuleTransition] = useState(false)
  const [moduleSeal, setModuleSeal] = useState('§ ·')
  const [moduleTitle, setModuleTitle] = useState('MODULE')
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLaunch(() => {
    useAuthStore.getState().hydrate()
    // 节气全局漫染 · 把 season 主题色注入 :root, 全站 accent / progress / 印章
    // 都跟随当前时节; H5 / weapp 都安全 (weapp 没 document, 内部静默跳过).
    applySeasonTheme()
    console.log('[App] onLaunch · auth hydrated · season theme applied')
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const MODULES: Array<{ path: string; seal: string; title: string }> = [
      { path: '/pages/operator-workbench/index', seal: '§ 01', title: '工作台' },
      { path: '/pages/adoptions/index', seal: '§ 01', title: '认养' },
      { path: '/pages/ai-assist/index', seal: '§ 02', title: 'AI询问' },
      { path: '/pages/me/index', seal: '§ 03', title: '我的' },
    ]

    const currentModulePath = () => {
      const raw = (window.location.hash || '').replace(/^#/, '') || window.location.pathname
      const hit = MODULES.find((m) => raw.startsWith(m.path))
      return hit?.path || ''
    }

    let prev = currentModulePath()

    const onRouteChanged = () => {
      const next = currentModulePath()
      if (!prev || !next || prev === next) {
        prev = next
        return
      }
      const meta = MODULES.find((m) => m.path === next)
      if (!meta) {
        prev = next
        return
      }
      setModuleSeal(meta.seal)
      setModuleTitle(meta.title)
      setShowModuleTransition(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => {
        setShowModuleTransition(false)
        hideTimerRef.current = null
      }, 920)
      prev = next
    }

    window.addEventListener('hashchange', onRouteChanged)
    return () => {
      window.removeEventListener('hashchange', onRouteChanged)
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [])

  return (
    <>
      {children}
      <FolioCorners />
      {showModuleTransition ? (
        <View className='app-module-transition' aria-hidden>
          <View className='app-module-transition__inner'>
            <View className='app-module-transition__ring'>
              <View className='app-module-transition__ring-outer' />
              <View className='app-module-transition__ring-inner' />
            </View>
            <View className='app-module-transition__mark'>
              <Text className='app-module-transition__mark-chapter'>{moduleSeal}</Text>
              <Text className='app-module-transition__mark-sep'>·</Text>
              <Text className='app-module-transition__mark-title'>{moduleTitle}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </>
  )
}

export default App
