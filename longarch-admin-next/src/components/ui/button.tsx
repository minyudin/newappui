import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useGsapButton } from '@/lib/useGsapButton'

/**
 * Button · 莫兰迪改皮
 * ============================================================
 *  原则:
 *   · 无圆角 · 无阴影 · hairline 边框
 *   · primary = 莫兰迪绿 (sage) 填充
 *   · danger  = 砖红 (clay) 填充
 *   · secondary = 纸浅底 + hairline
 *   · ghost  = 无边无底, hover 纸深底
 *   · link   = 衬线下划线
 * ============================================================ */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-sans tracking-[0.04em]',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sage focus-visible:ring-offset-0',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    '[&_svg]:shrink-0 [&_svg]:w-4 [&_svg]:h-4',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-sage text-paper-light hover:bg-moss',
        secondary: 'bg-paper-light text-ink border border-line hover:bg-paper-deep',
        ghost: 'bg-transparent text-ink hover:bg-paper-deep',
        danger: 'bg-clay text-paper-light hover:opacity-90',
        link: 'bg-transparent text-ink underline underline-offset-2 hover:opacity-60 h-auto px-0',
      },
      size: {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-10 px-4 text-[13px]',
        lg: 'h-11 px-6 text-[14px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const innerRef = React.useRef<HTMLButtonElement | null>(null)

    React.useImperativeHandle(ref, () => innerRef.current as HTMLButtonElement, [])
    useGsapButton(innerRef, { disabled: Boolean(props.disabled) })

    return (
      <Comp
        ref={innerRef}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
