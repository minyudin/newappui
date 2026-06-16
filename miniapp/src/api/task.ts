import { request } from './http'
import type {
  AllowedActionsResponse,
  CreateTaskReq,
  CreateTaskResponse,
  OperationTaskListItem,
  OperationTaskDetail,
  QueueStatus,
  CancelTaskResponse,
  PageResult,
} from '@/types'

/**
 * Task API · Miniapp
 * ============================================================
 *  §6.7 任务与调度 · 对应后端 OperationTaskController
 * ============================================================ */

/** 生成幂等键 · 前端按钮点击唯一标识 */
export function genIdempotencyKey(prefix = 'MP'): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${ts}_${rand}`
}

/**
 * API-20 获取地块允许的操作列表
 */
export function getAllowedActions(plotId: number) {
  return request<AllowedActionsResponse>({
    url: `/plots/${plotId}/allowed-actions`,
    method: 'GET',
  })
}

/**
 * API-21 创建操作任务
 * 必填: plotId + deviceId + actionType + actionParams + schedulingMode + idempotencyKey
 */
export function createOperationTask(req: CreateTaskReq) {
  return request<CreateTaskResponse>({
    url: '/operation-tasks',
    method: 'POST',
    data: req as unknown as Record<string, unknown>,
    silent: true, // 业务失败让调用方自己决定 UX
  })
}

/**
 * API-22 获取我的任务列表
 * @param taskStatus pending/queued/running/success/failed/cancelled (可选)
 */
export function getMyOperationTasks(params: {
  pageNo?: number
  pageSize?: number
  taskStatus?: string
} = {}) {
  const { pageNo = 1, pageSize = 20, taskStatus } = params
  const qs = new URLSearchParams({
    pageNo: String(pageNo),
    pageSize: String(pageSize),
    ...(taskStatus ? { taskStatus } : {}),
  }).toString()
  return request<PageResult<OperationTaskListItem>>({
    url: `/my/operation-tasks?${qs}`,
    method: 'GET',
  })
}

/**
 * API-23 获取任务详情
 */
export function getTaskDetail(taskId: number) {
  return request<OperationTaskDetail>({
    url: `/operation-tasks/${taskId}`,
    method: 'GET',
  })
}

/**
 * API-24 轮询排队状态 (比 detail 轻量, 用于 polling)
 */
export function getQueueStatus(taskId: number) {
  return request<QueueStatus>({
    url: `/operation-tasks/${taskId}/queue-status`,
    method: 'GET',
    silent: true,
  })
}

/**
 * API-25 取消任务
 * 仅 pending/queued 状态可取消
 */
export function cancelTask(taskId: number, reason?: string) {
  return request<CancelTaskResponse>({
    url: `/operation-tasks/${taskId}/cancel`,
    method: 'POST',
    data: reason ? { reason } : {},
  })
}
