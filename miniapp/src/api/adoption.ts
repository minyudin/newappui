import { request } from './http'
import type {
  VerifyCodeResponse,
  RedeemCodeResponse,
  ShareCodeItem,
  AdoptionListItem,
  AdoptionDetail,
  PageResult,
} from '@/types'

/**
 * Adoption API · Miniapp
 * ============================================================
 *  对应后端 AdoptionCodeController §API-04 / API-05
 * ============================================================ */

/**
 * API-04 预校验认养码
 * 不需要登录, 登录前也能判断码是否有效 + 预览权限
 */
export function verifyAdoptionCode(code: string) {
  return request<VerifyCodeResponse>({
    url: '/adoption-codes/verify',
    method: 'POST',
    data: { code },
    silent: true, // 失败由调用方自定 UI
  })
}

/**
 * API-05 兑换认养码
 * 需要登录 (会用 Sa-Token 的 userId 绑定 code.bindUserId)
 * 已被同一用户兑换过是幂等成功
 * 已被其他用户兑换会 throw BizException
 */
export function redeemAdoptionCode(code: string) {
  return request<RedeemCodeResponse>({
    url: '/adoption-codes/redeem',
    method: 'POST',
    data: { code },
    silent: true,
  })
}

/**
 * API-07 我的认养列表
 * @param pageNo    默认 1
 * @param pageSize  默认 20
 * @param status    过滤订单状态 · active/pending/expired/cancelled
 */
export function getMyAdoptions(params: {
  pageNo?: number
  pageSize?: number
  status?: string
} = {}) {
  const { pageNo = 1, pageSize = 20, status } = params
  const qs = new URLSearchParams({
    pageNo: String(pageNo),
    pageSize: String(pageSize),
    ...(status ? { status } : {}),
  }).toString()
  return request<PageResult<AdoptionListItem>>({
    url: `/my/adoptions?${qs}`,
    method: 'GET',
  })
}

/**
 * API-08 认养详情
 */
export function getAdoptionDetail(orderId: number) {
  return request<AdoptionDetail>({
    url: `/my/adoptions/${orderId}`,
    method: 'GET',
  })
}

/**
 * API-06 查询当前用户在地块上的访问范围
 * 用于入口前置门禁（例如访问时间窗）
 */
export function getMyAccessScope(plotId: number) {
  const qs = new URLSearchParams({ plotId: String(plotId) }).toString()
  return request({
    url: `/access-scopes/me?${qs}`,
    method: 'GET',
    silent: true,
  })
}

/**
 * API-42 生成分享码（基于当前用户该地块 master 码）
 */
export function createShareCode(data: {
  plotId: number
  validDays?: number
  canViewLive?: number
  canViewHistory?: number
  historyDays?: number
  canViewSensor?: number
  canOperate?: number
  operationWhitelist?: string
  maxDailyOperations?: number
  dailyAccessStart?: string
  dailyAccessEnd?: string
}) {
  return request<ShareCodeItem>({
    url: '/adoption-codes/share',
    method: 'POST',
    data,
    silent: true,
  })
}

/**
 * API-43 查询我生成的分享码
 */
export function getMyShareCodes(plotId?: number) {
  const qs = new URLSearchParams()
  if (plotId) qs.set('plotId', String(plotId))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return request<ShareCodeItem[]>({
    url: `/adoption-codes/my-shares${suffix}`,
    method: 'GET',
    silent: true,
  })
}

/**
 * API-44 撤销分享码
 */
export function revokeShareCode(codeId: number) {
  return request<void>({
    url: `/adoption-codes/${codeId}/revoke-share`,
    method: 'POST',
    silent: true,
  })
}
