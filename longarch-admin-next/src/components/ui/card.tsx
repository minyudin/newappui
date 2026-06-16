import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Card · hairline 纸卡容器
 * ============================================================
 *  提供 Card / CardHeader / CardSeal / CardTitle / CardContent / CardFooter
 *  无圆角 · 无阴影 · border-line hairline 分隔
 * ============================================================ */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border border-line bg-paper-light text-ink', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1 border-b border-line-soft px-4 py-3', className)}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardSeal = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'font-folio text-[10px] uppercase tracking-[0.22em] text-ink-faint',
        className,
      )}
      {...props}
    />
  ),
)
CardSeal.displayName = 'CardSeal'

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-serif text-[18px] leading-tight text-ink', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('font-serif italic text-[13px] text-ink-soft', className)}
      {...props}
    />
  ),
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 py-4', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2 border-t border-line-soft px-4 py-3',
        className,
      )}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'
