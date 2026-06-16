import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import { queryClient } from './lib/queryClient'
import { applySeasonTheme } from './lib/solarTerm'
import './index.scss'
import './tailwind.css'

// 启动时按当前节气往 :root 注入 --accent-current / data-season / data-term,
// 让全站章首印章 / hover 高亮 / 装饰线条都能跟随时节变色 (与小程序同源)
applySeasonTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  </StrictMode>,
)
