import * as React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pagination · folio 风
 * ============================================================
 *  左: "{total} entries · page 03 / 12" 等宽编号
 *  右: 左/右箭头, hairline 方形按钮
 * ============================================================ */

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  pageNo: number
  pageSize: number
  total: number
  onPageChange: (pageNo: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function Pagination({
  pageNo,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
  ...props
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = pageNo > 1
  const canNext = pageNo < totalPages
  const [draftPage, setDraftPage] = React.useState(String(pageNo))

  React.useEffect(() => {
    setDraftPage(String(pageNo))
  }, [pageNo])

  function goPage(nextPage: number) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages)
    if (safePage !== pageNo) onPageChange(safePage)
  }

  function commitDraftPage() {
    const parsed = Number(draftPage)
    if (!Number.isFinite(parsed)) {
      setDraftPage(String(pageNo))
      return
    }
    goPage(Math.trunc(parsed))
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-t border-line-soft py-3',
        className,
      )}
      {...props}
    >
      <div className="font-folio text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        {total} entries · page&nbsp;
        <span className="text-ink">{pad(pageNo)}</span>
        <span className="mx-[2px] text-ink-faint">/</span>
        {pad(totalPages)}
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 border border-line bg-paper px-2 font-folio text-[10px] uppercase tracking-[0.14em] text-ink"
            aria-label="Page size"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => goPage(1)}
            aria-label="First page"
            className={cn(
              'flex h-8 w-8 items-center justify-center border border-line bg-paper text-ink transition-colors',
              'hover:bg-sage/10',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper',
            )}
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => goPage(pageNo - 1)}
            aria-label="Previous page"
            className={cn(
              'flex h-8 w-8 items-center justify-center border border-line bg-paper text-ink transition-colors',
              'hover:bg-sage/10',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 font-folio text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          <input
            value={draftPage}
            onChange={(e) => setDraftPage(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commitDraftPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDraftPage()
            }}
            className="h-8 w-12 border border-line bg-paper px-2 text-center text-ink"
            inputMode="numeric"
            aria-label="Jump to page"
          />
          <span>/ {pad(totalPages)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canNext}
            onClick={() => goPage(pageNo + 1)}
            aria-label="Next page"
            className={cn(
              'flex h-8 w-8 items-center justify-center border border-line bg-paper text-ink transition-colors',
              'hover:bg-sage/10',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper',
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => goPage(totalPages)}
            aria-label="Last page"
            className={cn(
              'flex h-8 w-8 items-center justify-center border border-line bg-paper text-ink transition-colors',
              'hover:bg-sage/10',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-paper',
            )}
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
