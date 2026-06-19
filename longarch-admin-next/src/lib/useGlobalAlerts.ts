import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'

/**
 * useGlobalAlerts · 全局异常计数
 * ============================================================
 *  设计意图:
 *   · TopBar 红点 / Dashboard 异常清单 同一个口径, 不让两处出现
 *     "页头说 3 个异常 / 页面只显示 2 个" 这种割裂感
 *   · 复用与 Dashboard 同一个聚合 query (qk.dashboard.summary),
 *     React Query 自动去重 → 整个后台无论开几个页面, 每 30s 只发一次请求
 *
 *  口径 (后端计算, 见 AdminServiceImpl.getDashboardSummary):
 *   · sensor offline = status === 'offline' 或 lastSampleAt > 30 分钟前
 *   · device locked  = device_lock.lock_status === 'locked'
 *   · task failed    = task_status === 'failed'
 *
 *  注意: 这是一个 hook, 必须在 React 组件内部调用; 它会在组件 mount 期间
 *  持续保持 query 订阅, 卸载时自动清理 (useQuery 标准生命周期)
 * ============================================================ */

export interface GlobalAlerts {
  total: number
  offlineSensorCount: number
  lockedDeviceCount: number
  failedTaskCount: number
  loading: boolean
}

export function useGlobalAlerts(): GlobalAlerts {
  const q = useQuery({
    queryKey: qk.dashboard.summary(),
    queryFn: getDashboardSummary,
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const offlineSensorCount = q.data?.offlineSensorCount ?? 0
  const lockedDeviceCount = q.data?.lockedDeviceCount ?? 0
  const failedTaskCount = q.data?.failedTaskCount ?? 0
  return {
    total: offlineSensorCount + lockedDeviceCount + failedTaskCount,
    offlineSensorCount,
    lockedDeviceCount,
    failedTaskCount,
    loading: q.isPending,
  }
}
