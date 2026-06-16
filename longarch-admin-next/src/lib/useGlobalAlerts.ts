import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDevices, listSensorDevices, listTasks } from '@/api'
import type { SensorDevice } from '@/types/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'

/**
 * useGlobalAlerts · 全局异常计数
 * ============================================================
 *  设计意图:
 *   · TopBar 红点 / Dashboard 异常清单 同一个口径, 不让两处出现
 *     "页头说 3 个异常 / 页面只显示 2 个" 这种割裂感
 *   · 各 query 复用 staleTime + refetchInterval, 与 Dashboard 同步刷新
 *
 *  口径:
 *   · sensor offline = status === 'offline' 或 lastSampleAt > 30 分钟前
 *   · device locked  = lockStatus === 'locked'
 *   · task failed    = taskStatus === 'failed'
 *
 *  注意: 这是一个 hook, 必须在 React 组件内部调用; 它会在组件 mount 期间
 *  持续保持 query 订阅, 卸载时自动清理 (useQuery 标准生命周期)
 * ============================================================ */

const OFFLINE_THRESHOLD_MIN = 30

function isSensorOffline(s: SensorDevice): boolean {
  if (s.status === 'offline') return true
  const last = s.lastSampleAt as string | undefined
  if (!last) return false
  const then = Date.parse(last.replace(' ', 'T'))
  if (Number.isNaN(then)) return false
  return Date.now() - then > OFFLINE_THRESHOLD_MIN * 60 * 1000
}

export interface GlobalAlerts {
  total: number
  offlineSensorCount: number
  lockedDeviceCount: number
  failedTaskCount: number
  loading: boolean
}

export function useGlobalAlerts(): GlobalAlerts {
  const params = { pageNo: 1, pageSize: 100 }
  const sParams = { pageNo: 1, pageSize: 200 }

  const qSensors = useQuery({
    queryKey: qk.sensors.list(sParams),
    queryFn: () => listSensorDevices(sParams),
    staleTime: STALE.LIVE,
    refetchInterval: REFETCH.LIVE,
  })
  const qDevices = useQuery({
    queryKey: qk.devices.list(params),
    queryFn: () => listDevices(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const qTasks = useQuery({
    queryKey: qk.tasks.list(params),
    queryFn: () => listTasks(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })

  return useMemo<GlobalAlerts>(() => {
    const sensors = qSensors.data?.list ?? []
    const devices = qDevices.data?.list ?? []
    const tasks = qTasks.data?.list ?? []
    const offlineSensorCount = sensors.filter(isSensorOffline).length
    const lockedDeviceCount = devices.filter((d) => d.lockStatus === 'locked').length
    const failedTaskCount = tasks.filter((t) => t.taskStatus === 'failed').length
    return {
      total: offlineSensorCount + lockedDeviceCount + failedTaskCount,
      offlineSensorCount,
      lockedDeviceCount,
      failedTaskCount,
      loading: qSensors.isPending || qDevices.isPending || qTasks.isPending,
    }
  }, [qSensors.data, qDevices.data, qTasks.data, qSensors.isPending, qDevices.isPending, qTasks.isPending])
}
