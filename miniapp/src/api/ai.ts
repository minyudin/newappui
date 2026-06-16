import { request } from './http'
import type {
  AiChatReq,
  AiGeneralChatReq,
  AiChatResponse,
  AiCreateTaskReq,
  AiCreateTaskResponse,
  AiAnalysis,
} from '@/types'

/**
 * AI API · Miniapp
 * ============================================================
 *  §6 AI 助手 · 对应后端 AiController
 *    · /ai/chat                           对话 + 意图识别
 *    · /ai/actions/create-operation-task  AI 确认后创建任务
 *    · /ai/analysis/trigger               主动触发数据分析
 *    · /ai/analysis/latest                获取最新分析
 * ============================================================ */

/** 生成 sessionId · 前缀 MP · 时间戳 + 随机 */
export function genSessionId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `mp_${ts}_${rand}`
}

/** API-26 AI 对话 · 自动识别意图 + 决定 needConfirm */
export function aiChat(req: AiChatReq) {
  return request<AiChatResponse>({
    url: '/ai/chat',
    method: 'POST',
    data: req as unknown as Record<string, unknown>,
    silent: true, // 业务错让调用方自己显示 (气泡里提示更友好)
  })
}

/** AI 全局农业问答 · 不绑定地块 */
export function aiGeneralChat(req: AiGeneralChatReq) {
  return request<AiChatResponse>({
    url: '/ai/general-chat',
    method: 'POST',
    data: req as unknown as Record<string, unknown>,
    silent: true,
  })
}

/** API-27 AI 创建操作任务 · 用户确认后调用 */
export function aiCreateTask(req: AiCreateTaskReq) {
  return request<AiCreateTaskResponse>({
    url: '/ai/actions/create-operation-task',
    method: 'POST',
    data: req as unknown as Record<string, unknown>,
    silent: true,
  })
}

/** 触发 AI 数据分析 · 10min 节流 · 返回最新记录 */
export function triggerAnalysis(plotId: number) {
  return request<AiAnalysis>({
    url: `/ai/analysis/trigger?plotId=${plotId}`,
    method: 'POST',
    silent: true,
  })
}

/** 获取地块最新 AI 分析 · 404 静默 */
export function getLatestAnalysis(plotId: number) {
  return request<AiAnalysis>({
    url: `/ai/analysis/latest?plotId=${plotId}`,
    method: 'GET',
    silent: true,
  })
}

/** 中文动作名 · 复用给气泡里的 intent 显示 */
export const INTENT_LABEL: Record<string, string> = {
  irrigation_apply: '浇水',
  fertilize_apply: '施肥',
  spray_apply: '喷淋',
  general_query: '咨询',
  // AI 服务降级 (智谱 API key 未配 / 配额耗尽 / 网络失败) · 前端会标灰 + 提示
  fallback_unavailable: 'AI 服务降级',
}
