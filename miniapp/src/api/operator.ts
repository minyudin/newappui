import { request } from './http'
import type { PageResult } from '@/types'

export interface OperatorPlotItem {
  plotId: number
  plotName: string
  isPrimary: 0 | 1
}

export interface OperatorQueueTaskItem {
  taskId: number
  taskNo?: string
  plotId?: number
  actionType?: string
  taskStatus?: string
  createdAt?: string
  reviewState?: string
  riskLevel?: string
  riskReasons?: string
  assigneeUserId?: number | null
}

export function getMyOperatorPlots(params: { pageNo?: number; pageSize?: number } = {}) {
  const { pageNo = 1, pageSize = 50 } = params
  const qs = new URLSearchParams({ pageNo: String(pageNo), pageSize: String(pageSize) }).toString()
  return request<PageResult<OperatorPlotItem>>({
    url: `/operator/plots?${qs}`,
    method: 'GET',
  })
}

export function listOperatorQueueTasks(params: {
  pageNo?: number
  pageSize?: number
  reviewState?: string
  mine?: 0 | 1
} = {}) {
  const { pageNo = 1, pageSize = 20, reviewState, mine } = params
  const qs = new URLSearchParams({
    pageNo: String(pageNo),
    pageSize: String(pageSize),
    ...(reviewState ? { reviewState } : {}),
    ...(mine != null ? { mine: String(mine) } : {}),
  }).toString()
  return request<PageResult<OperatorQueueTaskItem>>({
    url: `/operator/operation-tasks?${qs}`,
    method: 'GET',
  })
}

export function claimOperatorTask(taskId: number) {
  return request<void>({
    url: `/operator/operation-tasks/${taskId}/claim`,
    method: 'POST',
    data: {},
  })
}

export function reviewOperatorTask(taskId: number, data: { decision: 'approve' | 'reject'; reason?: string }) {
  return request<void>({
    url: `/operator/operation-tasks/${taskId}/review`,
    method: 'POST',
    data,
  })
}

