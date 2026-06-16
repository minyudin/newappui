import axios from 'axios'
import type { PlatformConfig } from '@/types/api'

/**
 * 公开配置 API · 无需认证
 * ============================================================
 *  对齐 longarch-admin/src/api/admin.js:fetchPlatformConfig
 *
 *  特殊点:
 *   · 使用裸 axios (非 http 实例), 不走拦截器
 *   · 保留 code === 0 手动判断
 *   · 未登录的 /login 页也能拿到平台名称 (否则会陷入鸡生蛋循环)
 * ============================================================ */
export function fetchPlatformConfig(): Promise<PlatformConfig> {
  return axios.get('/api/v1/public/config').then((res) => {
    if (res.data && res.data.code === 0) return res.data.data as PlatformConfig
    return { platformName: '', dashboardTitle: '', dashboardSubtitle: '' }
  })
}
