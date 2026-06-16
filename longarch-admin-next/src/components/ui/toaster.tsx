import { Toaster as SonnerToaster } from 'sonner'

/**
 * Toaster · sonner 挂载点 + 莫兰迪改皮
 * ============================================================
 *  在 App 根部挂载一次即可
 *  调用方使用 @/lib/toast 的 toast.* (见 lib/toast.ts)
 * ============================================================ */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="light"
      duration={3000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex gap-2 items-start w-[var(--width)] px-4 py-3 border bg-paper-light text-ink font-sans',
          title: 'font-sans text-[13px] text-ink',
          description:
            'font-serif italic text-[12px] text-ink-soft mt-0.5',
          icon: 'mt-[2px]',
          default: 'border-line',
          success: 'border-sage',
          error: 'border-clay',
          warning: 'border-sand',
          info: 'border-fog',
        },
      }}
    />
  )
}
