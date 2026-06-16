import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import CommandPalette from './CommandPalette'
import './AppShell.scss'

/**
 * AppShell · 主外壳布局 (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  Sidebar (左 220px) + TopBar (上 52px) + Main (Outlet)
 *  登录页 /login 不套此壳, 由 router 直接渲染 LoginPage
 *
 *  启动引导 (/users/me 探测) 已上移到 <AuthBootstrap>, 这里只负责布局
 *  只有 RouteGuard 放行后 (bootstrapped=true + userInfo 存在) AppShell 才会 mount
 *
 *  全局键盘:
 *    ⌘K / Ctrl+K  · 打开命令面板
 *    /            · 在非 input 时, 也打开 (类 GitHub)
 * ============================================================ */
export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')
      const isSlash = e.key === '/' && !(e.target as HTMLElement | null)?.closest('input,textarea,[contenteditable]')
      if (isCmdK || isSlash) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="folio-app">
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />
      <main className="folio-app__main">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
