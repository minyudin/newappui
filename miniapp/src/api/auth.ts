import { request } from './http'
import type { LoginResponse, UserInfo } from '@/types'

/**
 * Auth API · Miniapp
 * ============================================================
 *  与 longarch-server 的 AuthController 一一对应
 * ============================================================ */

/**
 * API-01 微信登录
 * @param code       wx.login() 返回的 code (stub-mode 下任何字符串均可)
 * @param inviteCode 可选的认养码/邀请码
 */
export function wechatLogin(code: string, inviteCode?: string) {
  return request<LoginResponse>({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code, inviteCode },
    silent: true, // 登录失败由调用方自行处理 UI
  })
}

/**
 * 游客/分享码登录
 * @param code 分享码/游客码
 */
export function guestLogin(code: string) {
  return request<LoginResponse>({
    url: '/auth/guest-login',
    method: 'POST',
    data: { code },
    silent: true,
  })
}

/**
 * API-02 绑定手机号
 */
export function bindMobile(mobile: string, smsCode: string) {
  return request<{ bound: boolean }>({
    url: '/auth/bind-mobile',
    method: 'POST',
    data: { mobile, smsCode },
  })
}

/**
 * API-03 获取当前用户信息
 */
export function getCurrentUser() {
  return request<UserInfo>({
    url: '/users/me',
    method: 'GET',
  })
}

/**
 * 登出
 */
export function logout() {
  return request<void>({
    url: '/auth/logout',
    method: 'POST',
  })
}

/**
 * 注册补昵称 · 强制注册流程的"激活"步骤
 *  · 必须登录态 · 后端校验当前 user.nickname IS NULL 才允许设置
 *  · 失败 code: NICKNAME_INVALID(40019) / NICKNAME_DUPLICATED(40020) / NICKNAME_ALREADY_SET(40021)
 *  · silent=true · 由调用方在表单上直接显示错误, 不弹 toast 重叠
 */
export function setupNickname(nickname: string) {
  return request<UserInfo>({
    url: '/auth/setup-nickname',
    method: 'POST',
    data: { nickname },
    silent: true,
  })
}

/**
 * 改昵称 · 已注册用户主动改名
 *  · 与 setupNickname 区别: 后端不再校验 nickname IS NULL · 已设过也允许覆盖
 *  · 与当前同名 → 后端幂等 noop, 直接返当前 UserInfo
 *  · 失败码: NICKNAME_INVALID(40019) / NICKNAME_DUPLICATED(40020)
 */
export function changeNickname(nickname: string) {
  return request<UserInfo>({
    url: '/auth/change-nickname',
    method: 'POST',
    data: { nickname },
    silent: true,
  })
}

/** 昵称可用性预检 · 输入框失焦/防抖调用 · 始终走 silent 不打扰用户 */
export interface NicknameAvailability {
  available: boolean
  reason?: string | null
  normalized?: string
}
export function checkNicknameAvailability(nickname: string) {
  return request<NicknameAvailability>({
    url: '/auth/check-nickname',
    method: 'POST',
    data: { nickname },
    silent: true,
  })
}
