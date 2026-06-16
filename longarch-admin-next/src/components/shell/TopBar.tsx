import { useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { fetchPlatformConfig, logout as logoutApi } from '@/api'
import { qk } from '@/lib/queryKeys'
import { STALE } from '@/lib/queryClient'
import { useGsapButton } from '@/lib/useGsapButton'
import { getCurrentPentad } from '@/lib/solarTerm'
import { useGlobalAlerts } from '@/lib/useGlobalAlerts'
import './TopBar.scss'

/**
 * TopBar · 顶栏 52px (节气印章 + 异常 badge + ⌘K 提示版)
 * ============================================================
 *  左: 当前路由章节编号 (§N) + 平台名 + 节气印章 〈 立夏 · 第 1 候 · 蝼蝈鸣 〉
 *  右: 异常 badge (n ALERTS · 砖红呼吸) + ⌘K 提示按钮 + 平台名 + 用户 chip + 登出
 *
 *  设计意图:
 *   · 节气印章: 把"今日是何节气 / 第几候"作为页头的中式时间感, 与小程序
 *     的章首引言形成统一的"农时纪事"心智 (Folio 学术志风格的时间锚)
 *   · 异常 badge: 全站第一目光位提示运维侧"今日有几条异常待处理", 数字
 *     用呼吸点强调, 0 时静默 (用墨绿 ALL CLEAR 文字暗示)
 *   · ⌘K 提示: 在右上角放一个低调的快捷键提示, 让新用户知道"还有命令面板"
 * ============================================================ */

const ROUTE_TITLES: Record<string, { seal: string; cn: string; en: string }> = {
  '/dashboard':       { seal: '§1',  cn: '仪表盘',   en: 'Dashboard' },
  '/users':           { seal: '§2',  cn: '用户',     en: 'Users' },
  '/orders':          { seal: '§3',  cn: '认养订单', en: 'Orders' },
  '/codes':           { seal: '§4',  cn: '认养码',   en: 'Codes' },
  '/plots':           { seal: '§5',  cn: '地块',     en: 'Plots' },
  '/device-overview': { seal: '§6',  cn: '设备总览', en: 'Devices' },
  '/cameras':         { seal: '§7',  cn: '摄像头',   en: 'Cameras' },
  '/devices':         { seal: '§8',  cn: '执行设备', en: 'Actuators' },
  '/screens':         { seal: '§9',  cn: '大屏',     en: 'Screens' },
  '/tasks':           { seal: '§10', cn: '操作任务', en: 'Tasks' },
  '/operator-scopes': { seal: '§10C', cn: '责任域配置', en: 'Operator Scope' },
  '/sensor-data':     { seal: '§11', cn: '传感器数据', en: 'Sensor Data' },
}

interface Props {
  /** 命令面板入口 · AppShell 注入 */
  onOpenPalette?: () => void
}

export default function TopBar({ onOpenPalette }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const userInfo = useAuthStore((s) => s.userInfo)
  const clearStore = useAuthStore((s) => s.logout)
  const [loggingOut, setLoggingOut] = useState(false)
  const logoutRef = useRef<HTMLButtonElement | null>(null)

  // 平台配置 · 一次性元数据 · 永不过期
  const { data: cfg } = useQuery({
    queryKey: qk.platformConfig(),
    queryFn: fetchPlatformConfig,
    staleTime: STALE.STATIC,
    retry: false,
  })
  const platformName = cfg?.platformName ?? ''

  const route = ROUTE_TITLES[location.pathname]
  useGsapButton(logoutRef, { disabled: loggingOut })

  // 节气印章 · 每分钟以页面节奏自然刷新即可, 不做 setInterval
  const pentad = useMemo(() => getCurrentPentad(), [])

  // 异常 badge · 与 Dashboard 共享同一个 hook, 口径一致
  const alerts = useGlobalAlerts()

  // 登出流程 (cookie-first):
  //  1) 调 POST /auth/logout → 后端清 session + Set-Cookie 擦 satoken cookie
  //  2) 即使后端失败也本地清 store + query cache, 保证前端呈"已登出"态
  //  3) 跳 /login
  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logoutApi()
    } catch {
      // 网络异常或 session 已过期, 走本地清理即可
    } finally {
      clearStore()
      queryClient.clear()
      navigate('/login')
      setLoggingOut(false)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        {route && (
          <>
            <span className="topbar__seal">{route.seal}</span>
            <span className="topbar__sep">·</span>
            <span className="topbar__title-cn">{route.cn}</span>
            <span className="topbar__title-en">{route.en}</span>
          </>
        )}
        <span
          className={`topbar__pentad topbar__pentad--${pentad.term.season}`}
          title={`${pentad.term.name} · 第 ${pentad.index} 候 · ${pentad.name}`}
        >
          <span className="topbar__pentad-bracket">〈</span>
          <span className="topbar__pentad-term">{pentad.term.name}</span>
          <span className="topbar__pentad-dot">·</span>
          <span className="topbar__pentad-idx">第 {pentad.index} 候</span>
          <span className="topbar__pentad-dot">·</span>
          <span className="topbar__pentad-name">{pentad.name}</span>
          <span className="topbar__pentad-bracket">〉</span>
        </span>
      </div>
      <div className="topbar__right">
        {/* 异常计数 badge · 全站第一目光位 */}
        <button
          type="button"
          className={`topbar__alerts${alerts.total > 0 ? ' topbar__alerts--has' : ' topbar__alerts--clear'}`}
          onClick={() => navigate('/dashboard')}
          title={alerts.total > 0
            ? `传感器离线 ${alerts.offlineSensorCount} · 设备锁定 ${alerts.lockedDeviceCount} · 任务失败 ${alerts.failedTaskCount}`
            : '全部正常 · 无异常'}
        >
          <span className="topbar__alerts-dot" />
          {alerts.total > 0 ? (
            <>
              <span className="topbar__alerts-count">{alerts.total}</span>
              <span className="topbar__alerts-label">ALERTS</span>
            </>
          ) : (
            <span className="topbar__alerts-label">ALL CLEAR</span>
          )}
        </button>

        {onOpenPalette ? (
          <button
            type="button"
            className="topbar__cmd"
            onClick={onOpenPalette}
            title="打开命令面板 ⌘K / Ctrl+K"
          >
            <span className="topbar__cmd-key">⌘K</span>
            <span className="topbar__cmd-label">命令</span>
          </button>
        ) : null}

        {platformName && <span className="topbar__platform">{platformName}</span>}
        {userInfo && (
          <div className="topbar__user">
            <span className="topbar__user-role">
              {userInfo.roleProfile?.roleName || userInfo.roleType || 'Guest'}
            </span>
            <span className="topbar__user-name">
              {userInfo.nickname || userInfo.userNo || '—'}
            </span>
          </div>
        )}
        <button ref={logoutRef} type="button" className="topbar__logout" onClick={handleLogout}>
          登出 <em>Sign out</em>
        </button>
      </div>
    </header>
  )
}
