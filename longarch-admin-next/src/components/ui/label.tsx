import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

/**
 * Label · 印章式小标
 * ============================================================
 *  配合 Input / Select 使用, folio-mono + uppercase 小字
 * ============================================================ */
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'font-folio text-[10px] uppercase tracking-[0.2em] text-ink-soft',
      'peer-disabled:opacity-40 peer-disabled:cursor-not-allowed',
      className,
    )}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName
