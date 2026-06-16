import { NavLink } from 'react-router-dom'
import './Sidebar.scss'

/**
 * Sidebar · 左侧导航 220px (A.2 重排版)
 * ============================================================
 *  设计意图:
 *   12 个一级菜单按 §概览 / §认养 / §资产 / §调度 4 组分块, 每组上方
 *   带 hairline 分隔 + 印章标号 (§A / §B / §C / §D), 把"长平铺列表"
 *   切成"章节 - 条目"的两层视觉, 让 Wizard / Operator Scope 这种新增
 *   入口不会被淹没在末尾.
 *
 *  分组依据:
 *   §A 概览 · 仪表盘 + 命令面板入口
 *   §B 认养 · 新建认养 / 用户 / 订单 / 认养码
 *   §C 资产 · 地块 / 设备总览 / 摄像头 / 执行设备 / 大屏
 *   §D 调度 · 操作任务 / 责任域配置
 *
 *  其它:
 *   · 顶部 brand 区显示 ⌘K 提示按钮 (悬停露出, 点了打开命令面板)
 *   · NavLink 仍保留原 to + isActive 高亮逻辑
 *   · 列表视觉 (印章 / 中英 / 高亮条) 沿用 museum-folio
 * ============================================================ */

interface NavItem {
  to: string
  seal: string
  labelCn: string
  labelEn: string
}

interface NavGroup {
  seal: string
  labelCn: string
  labelEn: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    seal: '§A', labelCn: '概览', labelEn: 'Overview',
    items: [
      { to: '/dashboard', seal: '§1', labelCn: '仪表盘', labelEn: 'Dashboard' },
    ],
  },
  {
    seal: '§B', labelCn: '认养', labelEn: 'Adoption',
    items: [
      { to: '/adoptions/new', seal: '§+', labelCn: '新建认养', labelEn: 'New Adoption' },
      { to: '/users',         seal: '§2', labelCn: '用户',     labelEn: 'Users' },
      { to: '/orders',        seal: '§3', labelCn: '认养订单', labelEn: 'Orders' },
      { to: '/codes',         seal: '§4', labelCn: '认养码',   labelEn: 'Codes' },
    ],
  },
  {
    seal: '§C', labelCn: '资产', labelEn: 'Assets',
    items: [
      { to: '/plots',           seal: '§5', labelCn: '地块',     labelEn: 'Plots' },
      { to: '/device-overview', seal: '§6', labelCn: '设备总览', labelEn: 'Devices' },
      { to: '/cameras',         seal: '§7', labelCn: '摄像头',   labelEn: 'Cameras' },
      { to: '/devices',         seal: '§8', labelCn: '执行设备', labelEn: 'Actuators' },
      { to: '/screens',         seal: '§9', labelCn: '大屏',     labelEn: 'Screens' },
    ],
  },
  {
    seal: '§D', labelCn: '调度', labelEn: 'Operate',
    items: [
      { to: '/tasks',           seal: '§10',  labelCn: '操作任务',   labelEn: 'Tasks' },
      { to: '/operator-scopes', seal: '§10C', labelCn: '责任域配置', labelEn: 'Operator Scope' },
    ],
  },
]

interface Props {
  /**
   * 由 AppShell 注入, 点 brand 区的 ⌘K 提示按钮触发命令面板.
   * 可选 · 不传则不渲染按钮 (兼容老调用).
   */
  onOpenPalette?: () => void
}

export default function Sidebar({ onOpenPalette }: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar__brand">
        <div className="sidebar__museum-name">
          <span className="sidebar__museum-name-en">Longarch</span>
          <span className="sidebar__cn">陇上</span>
        </div>
      </header>

      <nav className="sidebar__nav" aria-label="Chapters">
        {NAV_GROUPS.map((g, gi) => (
          <div key={g.seal} className={`sidebar__group${gi === 0 ? ' sidebar__group--first' : ''}`}>
            <div className="sidebar__group-head">
              <span className="sidebar__group-seal">{g.seal}</span>
              <span className="sidebar__group-cn">{g.labelCn}</span>
              <span className="sidebar__group-en">{g.labelEn}</span>
            </div>
            {g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
                <span className="sidebar__seal">{item.seal}</span>
                <span className="sidebar__label">
                  <span className="sidebar__label-cn">{item.labelCn}</span>
                  <span className="sidebar__label-en">{item.labelEn}</span>
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* 底部 ⌘K 入口 · 与 TopBar 的 ⌘K 按钮共生
          挪到这里是为了让 brand 区只承载品牌名, 不被命令按钮挤压 */}
      {onOpenPalette ? (
        <footer className="sidebar__foot">
          <button
            type="button"
            className="sidebar__cmd"
            onClick={onOpenPalette}
            title="打开命令面板 ⌘K / Ctrl+K"
          >
            <span className="sidebar__cmd-key">⌘K</span>
            <span className="sidebar__cmd-label">命令面板</span>
            <span className="sidebar__cmd-hint">Search · Jump</span>
          </button>
        </footer>
      ) : null}
    </aside>
  )
}
