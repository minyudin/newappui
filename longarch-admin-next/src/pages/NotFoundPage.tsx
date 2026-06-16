import { Link } from 'react-router-dom'
import PageShell from '@/components/shell/PageShell'

/**
 * NotFoundPage · 404
 * ============================================================
 *  Folio 格式的 404 · 走 AppShell (登录后才会出现)
 * ============================================================ */
export default function NotFoundPage() {
  return (
    <PageShell
      seal="§404"
      title="Not Found"
      titleCn="未 收 录"
      lede="This chapter does not exist in the current folio."
    >
      <div className="folio-page__wip">
        <Link to="/dashboard">
          ← Back to §1 Dashboard
        </Link>
      </div>
    </PageShell>
  )
}
