import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input · 莫兰迪改皮
 * ============================================================
 *  无圆角 · hairline · focus 切 sage
 * ============================================================ */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-10 w-full border border-line bg-paper px-3 py-2 font-sans text-[13px] text-ink',
          'placeholder:text-ink-faint',
          'transition-colors',
          'focus:outline-none focus:border-sage',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
