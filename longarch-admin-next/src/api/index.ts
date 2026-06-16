/**
 * API 层统一导出
 * ============================================================
 *  使用方式:
 *    import { listUsers, devLogin, fetchPlatformConfig } from '@/api'
 *    import http from '@/api/http'  // 直接拿 axios 实例 (罕见)
 * ============================================================ */

export { default as http, setHttpNavigate } from './http'
export * from './public'
export * from './auth'
export * from './admin'
