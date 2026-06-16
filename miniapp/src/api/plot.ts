import { request } from './http'
import type {
  PlotDetail,
  CropBatchDetail,
  FarmingRecord,
  Sensor,
  SensorSummary,
  SensorHistory,
  OperationTaskListItem,
  PageResult,
} from '@/types'

/**
 * Plot API · Miniapp
 * ============================================================
 *  §2 地块 · §3 作物 · §4 传感器 · §5 农事
 *  对应后端 PlotController + SensorController
 * ============================================================ */

/** API-09 获取地块详情 */
export function getPlotDetail(plotId: number) {
  return request<PlotDetail>({
    url: `/plots/${plotId}`,
    method: 'GET',
  })
}

/** API-10 获取当前作物批次详情 (失败表示当前无活跃批次, 静默处理) */
export function getCropBatch(plotId: number) {
  return request<CropBatchDetail>({
    url: `/plots/${plotId}/crop-batch`,
    method: 'GET',
    silent: true,
  })
}

/** API-11 获取地块农事记录 (paged) */
export function getFarmingRecords(plotId: number, pageNo = 1, pageSize = 20) {
  return request<PageResult<FarmingRecord>>({
    url: `/plots/${plotId}/farming-records?pageNo=${pageNo}&pageSize=${pageSize}`,
    method: 'GET',
  })
}

/** API-12 获取地块操作记录 (paged) · 和 /my/operation-tasks 字段同, 按 plot 过滤 */
export function getOperationLogs(plotId: number, pageNo = 1, pageSize = 20) {
  return request<PageResult<OperationTaskListItem>>({
    url: `/plots/${plotId}/operation-logs?pageNo=${pageNo}&pageSize=${pageSize}`,
    method: 'GET',
  })
}

/** API-17 获取地块传感器列表 (含 lastValue) */
export function getSensorList(plotId: number) {
  return request<Sensor[]>({
    url: `/plots/${plotId}/sensors`,
    method: 'GET',
  })
}

/** API-18 获取传感器数据摘要 · 按 sensor-type 归并 · 用于地块详情页 */
export function getSensorSummary(plotId: number) {
  return request<SensorSummary>({
    url: `/plots/${plotId}/sensor-summary`,
    method: 'GET',
  })
}

/**
 * API-19 获取传感器历史曲线
 * @param sensorId     传感器 id
 * @param startTime    'yyyy-MM-dd HH:mm:ss'
 * @param endTime      'yyyy-MM-dd HH:mm:ss'
 * @param granularity  '1h' | '10m' | '1d' (默认 1h)
 */
export function getSensorHistory(
  sensorId: number,
  startTime: string,
  endTime: string,
  granularity: '10m' | '1h' | '1d' = '1h',
) {
  const qs = new URLSearchParams({
    startTime,
    endTime,
    granularity,
  }).toString()
  return request<SensorHistory>({
    url: `/sensors/${sensorId}/history?${qs}`,
    method: 'GET',
    silent: true,
  })
}
