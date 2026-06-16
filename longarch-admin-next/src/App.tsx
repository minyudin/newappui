import AppRouter from './router'
import { Toaster } from '@/components/ui/toaster'

/**
 * Longarch Folio · App Root
 * ============================================================
 *  App.tsx 负责挂 Router + 全局 Toaster (sonner)
 *  所有页面布局与守卫都在 src/router/index.tsx
 * ============================================================
 */
export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  )
}
