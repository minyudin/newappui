import { request } from './http'
import type { Camera, LiveUrl, PlaybackUrl, Snapshot } from '@/types'

/**
 * Camera API · Miniapp
 * ============================================================
 *  §5 视频监控 · 对应后端 CameraController
 *    · API-13  GET  /plots/{plotId}/cameras          摄像头列表
 *    · API-14  GET  /cameras/{cameraId}/live-url     实时流地址 (FLV + HLS)
 *    · API-15  GET  /cameras/{cameraId}/playback-url 回放地址
 *    · API-16  GET  /cameras/{cameraId}/snapshot     SRS 快照
 *
 *  说明:
 *    小程序 <live-player> 原生组件要求 "直播类目" 白名单 + 企业主体, 农业类目
 *    目前不在白名单内. 走 <web-view> + H5 flv.js/hls.js 路线绕开. 详见
 *    src/pages/camera/index.tsx 的注释.
 * ============================================================ */

/** API-13 获取地块摄像头列表 */
export function getCameraList(plotId: number) {
  return request<Camera[]>({
    url: `/plots/${plotId}/cameras`,
    method: 'GET',
  })
}

/** API-14 获取实时流地址 · 返回 flvUrl + hlsUrl 两路 */
export function getLiveUrl(cameraId: number) {
  return request<LiveUrl>({
    url: `/cameras/${cameraId}/live-url`,
    method: 'GET',
    silent: true, // 权限不足等由调用方 UI 处理
  })
}

/** API-15 获取历史回放地址 */
export function getPlaybackUrl(cameraId: number, startTime: string, endTime: string) {
  const qs = new URLSearchParams({ startTime, endTime }).toString()
  return request<PlaybackUrl>({
    url: `/cameras/${cameraId}/playback-url?${qs}`,
    method: 'GET',
    silent: true,
  })
}

/** API-16 获取截图 · 相同 URL 服务端每次会新拍一张 */
export function getSnapshot(cameraId: number) {
  return request<Snapshot>({
    url: `/cameras/${cameraId}/snapshot`,
    method: 'GET',
    silent: true,
  })
}
