import { toast as sonnerToast } from 'sonner'

/**
 * Toast · sonner 封装 (P4 改皮版)
 * ============================================================
 *  Toaster 挂载点在 App.tsx 的 <Toaster /> (src/components/ui/toaster.tsx)
 *  保留原 toast.success / error / info / warning 接口不变,
 *  P2 以来所有调用处无需修改
 * ============================================================ */
export const toast = {
  success(msg: string) {
    sonnerToast.success(msg)
  },
  error(msg: string) {
    sonnerToast.error(msg)
  },
  info(msg: string) {
    sonnerToast(msg)
  },
  warning(msg: string) {
    sonnerToast.warning(msg)
  },
}
