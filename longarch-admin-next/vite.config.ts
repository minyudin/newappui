import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// ============================================================
//  Vite · longarch-admin-next
//  端口 5175 · 避开旧 admin 5174 与 bridge-viz 5173
//  /api/v1 代理到本地后端 8081
// ============================================================
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
