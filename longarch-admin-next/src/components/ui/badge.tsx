import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge · 状态标签
 * ============================================================
 *  7 种莫兰迪 tone · 对应角色 / 状态
 *  无圆角 · hairline · folio-mono 小字
 * ============================================================ */
const badgeVariants = cva(
  'inline-flex items-center gap-1 border px-2 py-[2px] font-folio text-[10px] uppercase tracking-[0.18em] leading-none',
  {
    variants: {
      tone: {
        neutral: 'border-line text-ink-soft bg-paper-light',
        sage:    'border-sage/70 text-[color:var(--color-sage)] bg-sage/10',
        fog:     'border-fog/70  text-[color:var(--color-fog)]  bg-fog/10',
        sand:    'border-sand/80 text-ink-soft bg-sand/20',
        clay:    'border-clay/70 text-[color:var(--color-clay)] bg-clay/10',
        moss:    'border-moss/70 text-[color:var(--color-moss)] bg-moss/10',
        plum:    'border-plum/70 text-[color:var(--color-plum)] bg-plum/10',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { badgeVariants }
