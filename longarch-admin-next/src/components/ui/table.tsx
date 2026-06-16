import * as React from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

/**
 * Table · hairline 列表
 * ============================================================
 *  表头: uppercase folio-mono · hairline bottom
 *  行:   hairline-soft 分隔 · hover 淡 sage 底
 *  无圆角 · 无阴影
 * ============================================================ */

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn(
          'w-full border-collapse font-sans text-[13px] text-ink',
          className,
        )}
        {...props}
      />
    </div>
  ),
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn('', className)} {...props} />,
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('', className)} {...props} />,
)
TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn('border-t border-line bg-paper-deep/50 font-medium', className)}
      {...props}
    />
  ),
)
TableFooter.displayName = 'TableFooter'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-line-soft transition-colors',
        'hover:bg-sage/5',
        'data-[state=selected]:bg-sage/10',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 px-3 text-left align-middle',
        'font-folio text-[10px] uppercase tracking-[0.2em] text-ink-faint',
        'border-b border-line',
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-3 py-3 align-middle', className)}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn('mt-4 font-serif italic text-[12px] text-ink-faint', className)}
      {...props}
    />
  ),
)
TableCaption.displayName = 'TableCaption'

export interface TableEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

export function TableEmpty({ className, children = 'No entries in this folio.', ...props }: TableEmptyProps) {
  return (
    <div
      className={cn(
        'py-12 text-center font-serif italic text-[13px] text-ink-faint',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TableErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode
  message?: React.ReactNode
  onRetry?: () => void
}

export function TableError({
  className,
  heading = '加载失败',
  message = '数据暂时无法读取，请稍后重试。',
  onRetry,
  ...props
}: TableErrorProps) {
  return (
    <div
      className={cn(
        'py-12 text-center font-sans text-[13px] text-ink-soft',
        className,
      )}
      {...props}
    >
      <div className="font-serif italic text-[14px] text-clay">{heading}</div>
      <div className="mt-2">{message}</div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          重试
        </Button>
      ) : null}
    </div>
  )
}
