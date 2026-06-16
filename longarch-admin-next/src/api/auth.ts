import http from './http'
import type {
  AdminLoginReq,
  AdminLoginRes,
  DevLoginReq,
  DevLoginRes,
  UserInfo,
} from '@/types/api'

/**
 * 认证 API (Cookie-First 重构 · 2026-04)
 * ============================================================
 *  · adminLogin:     手机号+密码, 后端下发 HttpOnly satoken cookie
 *  · devLogin:       dev 便捷, openId 直登, 仅 stub-mode=true 可用
 *  · getCurrentUser: 启动引导 + 硬刷新回填 userInfo
 *  · logout:         清 Redis session + 擦 HttpOnly cookie
 * ============================================================ */

/**
 * 管理员后台密码登录 (主要入口)
 * 对齐后端 POST /api/v1/auth/admin-login
 * 成功后后端自动 Set-Cookie: satoken=...; HttpOnly
 */
export function adminLogin(data: AdminLoginReq): Promise<AdminLoginRes> {
  return http.post('/auth/admin-login', data)
}

/**
 * 开发环境快速登录 (仅 dev/stub 模式)
 * @param data openId
 * @returns userInfo (token 在 cookie 里, body 的 token 字段仅供兼容不再消费)
 */
export function devLogin(data: DevLoginReq): Promise<DevLoginRes> {
  return http.post('/auth/dev-login', data)
}

/**
 * 当前登录用户信息 · 对齐后端 GET /api/v1/users/me
 * 用于启动引导探测 session + 硬刷新回填 userInfo
 */
export function getCurrentUser(): Promise<UserInfo> {
  return http.get('/users/me')
}

/**
 * 登出 · 对齐后端 POST /api/v1/auth/logout
 * 后端 StpUtil.logout() 清 Redis session + 写 Set-Cookie: satoken=; Max-Age=0
 */
export function logout(): Promise<void> {
  return http.post('/auth/logout')
}
