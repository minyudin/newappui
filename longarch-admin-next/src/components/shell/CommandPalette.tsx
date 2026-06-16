import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CommandPalette.scss'

/**
 * CommandPalette · ⌘K 全站命令面板
 * ============================================================
 *  键盘体验:
 *    ⌘K / Ctrl+K  · 打开
 *    Esc          · 关闭
 *    ↑ ↓          · 选择
 *    Enter        · 执行
 *    Tab          · 切换 group
 *
 *  能干什么:
 *   1. 模糊搜命令 (跳转 / 新建)
 *   2. 输入纯数字 → 当作 plotId / taskId / orderId 直接跳详情
 *   3. 输入 T-…, T- 开头当任务编号
 *   4. 输入 LSGJ- 开头当认养码
 *
 *  实现备注:
 *   · 不引 cmdk 库, 自己写 80 行更可控且和 Folio 风格一致
 *   · 命令源是静态注册 + 路由动态生成两种
 * ============================================================ */

interface Cmd {
  id: string
  group: 'navigate' | 'create' | 'jump'
  /** 主标题 (中文) */
  title: string
  /** 副标题 (英文 / 路径 / hint) */
  hint?: string
  /** 印章前缀, 如 §1 */
  seal?: string
  /** 关键字 · 搜索匹配池 */
  keywords: string[]
  run: () => void
}

const NAV_CMDS: Array<Omit<Cmd, 'run'> & { to: string }> = [
  { id: 'nav-dashboard',  group: 'navigate', title: '仪表盘', hint: 'Dashboard', seal: '§1',  keywords: ['dashboard', '仪表', 'kpi'],   to: '/dashboard' },
  { id: 'nav-wizard',     group: 'navigate', title: '新建认养', hint: 'New Adoption', seal: '§+', keywords: ['adoption', '认养', 'wizard'], to: '/adoptions/new' },
  { id: 'nav-users',      group: 'navigate', title: '用户', hint: 'Users', seal: '§2',  keywords: ['users', '用户', 'people'],     to: '/users' },
  { id: 'nav-orders',     group: 'navigate', title: '认养订单', hint: 'Orders', seal: '§3', keywords: ['orders', '订单'],            to: '/orders' },
  { id: 'nav-codes',      group: 'navigate', title: '认养码', hint: 'Codes', seal: '§4',  keywords: ['codes', '认养码'],             to: '/codes' },
  { id: 'nav-plots',      group: 'navigate', title: '地块', hint: 'Plots', seal: '§5',  keywords: ['plots', '地块', '大棚'],         to: '/plots' },
  { id: 'nav-devices',    group: 'navigate', title: '设备总览', hint: 'Devices', seal: '§6', keywords: ['devices', '设备'],          to: '/device-overview' },
  { id: 'nav-cameras',    group: 'navigate', title: '摄像头', hint: 'Cameras', seal: '§7',  keywords: ['cameras', '摄像头'],         to: '/cameras' },
  { id: 'nav-actuators',  group: 'navigate', title: '执行设备', hint: 'Actuators', seal: '§8', keywords: ['actuators', '执行器', '阀'], to: '/devices' },
  { id: 'nav-screens',    group: 'navigate', title: '大屏', hint: 'Screens', seal: '§9',  keywords: ['screens', '大屏'],            to: '/screens' },
  { id: 'nav-tasks',      group: 'navigate', title: '操作任务', hint: 'Tasks', seal: '§10', keywords: ['tasks', '任务', '操作'],     to: '/tasks' },
  { id: 'nav-scopes',     group: 'navigate', title: '责任域配置', hint: 'Operator Scope', seal: '§10C', keywords: ['operator', '运营', '责任域'], to: '/operator-scopes' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 重置
  useEffect(() => {
    if (open) {
      setQ('')
      setCur(0)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  // 命令池 · 静态 + 动态 (根据输入推断的"jump")
  const cmds: Cmd[] = useMemo(() => {
    const base: Cmd[] = NAV_CMDS.map((n) => ({
      id: n.id,
      group: n.group,
      title: n.title,
      hint: n.hint,
      seal: n.seal,
      keywords: n.keywords,
      run: () => navigate(n.to),
    }))
    base.push({
      id: 'create-plot',
      group: 'create',
      title: '新建地块',
      hint: 'Create plot',
      seal: '§+',
      keywords: ['create plot', '新地块', 'new plot'],
      run: () => navigate('/plots?create=1'),
    })
    base.push({
      id: 'create-code',
      group: 'create',
      title: '签发认养码',
      hint: 'Issue adoption code',
      seal: '§+',
      keywords: ['issue', '签发', 'code', '认养码'],
      run: () => navigate('/codes?openCreate=1'),
    })
    base.push({
      id: 'create-screen',
      group: 'create',
      title: '绑定大屏',
      hint: 'Bind screen',
      seal: '§+',
      keywords: ['screen', '大屏', 'bind'],
      run: () => navigate('/screens'),
    })

    // 动态 jump
    const trimmed = q.trim()
    if (/^\d{2,}$/.test(trimmed)) {
      // 纯数字 → 猜 plot / order / task
      base.unshift({
        id: 'jump-plot',
        group: 'jump',
        title: `跳转地块 #${trimmed}`,
        hint: `/plots/${trimmed}`,
        seal: '↗',
        keywords: [trimmed],
        run: () => navigate(`/plots?id=${trimmed}`),
      })
      base.unshift({
        id: 'jump-task',
        group: 'jump',
        title: `跳转任务 #${trimmed}`,
        hint: `/tasks/${trimmed}`,
        seal: '↗',
        keywords: [trimmed],
        run: () => navigate(`/tasks?id=${trimmed}`),
      })
    }
    if (/^T-?\w+/i.test(trimmed)) {
      base.unshift({
        id: 'jump-task-no',
        group: 'jump',
        title: `任务编号 ${trimmed}`,
        hint: 'Search by task no',
        seal: '↗',
        keywords: [trimmed],
        run: () => navigate(`/tasks?taskNo=${trimmed}`),
      })
    }
    if (/^LSGJ-/i.test(trimmed)) {
      base.unshift({
        id: 'jump-code',
        group: 'jump',
        title: `认养码 ${trimmed}`,
        hint: 'Search by code',
        seal: '↗',
        keywords: [trimmed],
        run: () => navigate(`/codes?code=${trimmed}`),
      })
    }
    return base
  }, [q, navigate])

  // 模糊匹配 (子序列)
  const filtered = useMemo(() => {
    const trimmed = q.trim().toLowerCase()
    if (!trimmed) return cmds
    return cmds.filter((c) => {
      const pool = (c.title + ' ' + (c.hint || '') + ' ' + c.keywords.join(' ')).toLowerCase()
      return pool.includes(trimmed)
    })
  }, [cmds, q])

  // 分组
  const groups = useMemo(() => {
    const out: Record<string, Cmd[]> = { jump: [], navigate: [], create: [] }
    for (const c of filtered) out[c.group].push(c)
    return out
  }, [filtered])

  // 键盘
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCur((c) => Math.min(filtered.length - 1, c + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCur((c) => Math.max(0, c - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const target = filtered[cur]
        if (target) {
          target.run()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, cur, onClose])

  if (!open) return null

  let visIndex = -1

  return (
    <div className='cmdp' role='dialog' aria-modal='true' onMouseDown={onClose}>
      <div className='cmdp__panel' onMouseDown={(e) => e.stopPropagation()}>
        <div className='cmdp__bar'>
          <span className='cmdp__seal'>§ ⌘K</span>
          <input
            ref={inputRef}
            className='cmdp__input'
            value={q}
            onChange={(e) => { setQ(e.target.value); setCur(0) }}
            placeholder='搜索命令 · 输 ID / 任务号 / 认养码可直跳'
            autoComplete='off'
            spellCheck={false}
          />
          <span className='cmdp__count'>{filtered.length}</span>
        </div>

        <div className='cmdp__body'>
          {filtered.length === 0 ? (
            <div className='cmdp__empty'>— 无匹配 —</div>
          ) : (
            <>
              {(['jump', 'navigate', 'create'] as const).map((gk) => {
                const list = groups[gk]
                if (list.length === 0) return null
                const label = gk === 'jump' ? '智能跳转' : gk === 'navigate' ? '页面' : '新建'
                return (
                  <div key={gk} className='cmdp__group'>
                    <div className='cmdp__group-label'>§ {label}</div>
                    {list.map((c) => {
                      visIndex += 1
                      const active = visIndex === cur
                      return (
                        <button
                          key={c.id}
                          type='button'
                          className={`cmdp__item ${active ? 'cmdp__item--active' : ''}`}
                          onMouseEnter={() => setCur(visIndex)}
                          onClick={() => { c.run(); onClose() }}
                        >
                          {c.seal ? <span className='cmdp__item-seal'>{c.seal}</span> : <span className='cmdp__item-seal' />}
                          <span className='cmdp__item-title'>{c.title}</span>
                          {c.hint ? <span className='cmdp__item-hint'>{c.hint}</span> : null}
                          {active ? <span className='cmdp__item-key'>↵</span> : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className='cmdp__footer'>
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}
