import type { ReactNode } from 'react'

interface PageShellProps {
  seal: string
  title: string
  titleCn?: string
  lede?: ReactNode
  right?: ReactNode
  children: ReactNode
}

/**
 * PageShell · 页面通用壳
 * ============================================================
 *  统一页头 (seal / title / titleCn / lede / right) + body
 *  复用 .folio-page 全局样式 (见 src/index.scss)
 *  源自 museum-folio/src/pages/shared/PageShell.tsx
 * ============================================================ */
export default function PageShell({
  seal,
  title,
  titleCn,
  lede,
  right,
  children,
}: PageShellProps) {
  return (
    <main className="folio-page">
      <header className="folio-page__header folio-page__header--split">
        <div className="folio-page__head-left">
          <span className="folio-page__seal">{seal}</span>
          <h1 className="folio-page__title">
            {title}
            {titleCn && <span className="folio-page__title-cn">{titleCn}</span>}
          </h1>
          {lede && (
            <p className="folio-page__sub">
              <em>{lede}</em>
            </p>
          )}
        </div>
        {right && <div className="folio-page__head-right">{right}</div>}
      </header>
      <section className="folio-page__body">{children}</section>
    </main>
  )
}
