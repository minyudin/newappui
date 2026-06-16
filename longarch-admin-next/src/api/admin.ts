import http from './http'
import type {
  PageQuery,
  PaginatedList,
  AdminUser,
  CreateUserReq,
  AdoptionOrder,
  AdoptionCode,
  Plot,
  ActuatorDevice,
  OperationTask,
  Screen,
  Camera,
  SensorDevice,
  SensorDataPoint,
  DeviceOverview,
  PlotSensorOverview,
} from '@/types/api'

/**
 * 管理后台业务 API
 * ============================================================
 *  严格对应 longarch-admin/src/api/admin.js (30 个端点)
 *  函数名 · 参数顺序 · URL 路径 · HTTP 方法 完全 1:1 一致
 *
 *  新版增量:
 *   · 返回值加上 Promise<T> 类型
 *   · 入参对象类型化 (请求体用 Record<string, unknown> 占位, P5 按页细化)
 *
 *  注意: 因拦截器已脱壳 (code===0 时返回 data.data),
 *        每个函数的 Promise<T> 中的 T 就是业务数据本身, 不含 code/message
 * ============================================================ */

type AnyReqBody = Record<string, unknown>

// ============================================================
//  辅助 · 昵称可用性预检 (复用 /auth/check-nickname · 不需 admin 角色)
// ============================================================

export interface NicknameAvailability {
  available: boolean
  reason?: string | null
  normalized?: string
}

export function checkNicknameAvailability(nickname: string): Promise<NicknameAvailability> {
  return http.post('/auth/check-nickname', { nickname })
}

/**
 * Admin 强改任意用户昵称
 *  · 后端 PUT /admin/users/{userId}/nickname (SaCheckRole=admin)
 *  · 复用 NicknameValidator + uk_nickname 兜底链路
 *  · 同名值 → 后端幂等 noop, 直接返当前 VO
 */
export function updateUserNickname(
  userId: number | string,
  nickname: string,
): Promise<AdminUser> {
  return http.put(`/admin/users/${userId}/nickname`, { nickname })
}

// ============================================================
//  列表查询 (6)
// ============================================================

export function listUsers(params?: PageQuery): Promise<PaginatedList<AdminUser>> {
  return http.get('/admin/users', { params })
}

export function listOrders(params?: PageQuery): Promise<PaginatedList<AdoptionOrder>> {
  return http.get('/admin/adoption-orders', { params })
}

export function listCodes(params?: PageQuery): Promise<PaginatedList<AdoptionCode>> {
  return http.get('/admin/adoption-codes', { params })
}

export function listPlots(params?: PageQuery): Promise<PaginatedList<Plot>> {
  return http.get('/admin/plots', { params })
}

export function listDevices(params?: PageQuery): Promise<PaginatedList<ActuatorDevice>> {
  return http.get('/admin/actuator-devices', { params })
}

export function listTasks(params?: PageQuery): Promise<PaginatedList<OperationTask>> {
  return http.get('/admin/operation-tasks', { params })
}

/**
 * 任务详情 · 复用 /operation-tasks/{id} 共享端点
 * -----------------------------------------------------------
 *  后端 OperationTaskController.getTaskDetail() 只做 SaCheckLogin, 没做用户过滤,
 *  所以 admin 登录态也能调. 不再单独建 /admin/operation-tasks/{id} 避免后端冗余.
 *  返回包含 actionParams / queuedAt / startedAt / cancelable 等列表不返的字段.
 */
export function getTaskDetail(taskId: number | string): Promise<OperationTask> {
  return http.get(`/operation-tasks/${taskId}`)
}

// ============================================================
//  创建 (4)
// ============================================================

export function createUser(data: CreateUserReq): Promise<AdminUser> {
  return http.post('/admin/users', data)
}

export function createOrder(data: AnyReqBody): Promise<AdoptionOrder> {
  return http.post('/admin/adoption-orders', data)
}

export function createCode(data: AnyReqBody): Promise<AdoptionCode> {
  return http.post('/admin/adoption-codes', data)
}

/**
 * 认养码详情 · 对齐后端 AdoptionCodeDetailVO
 * 含完整权限矩阵(canViewHistory/historyDays/canViewSensor/maxDailyOperations/operationWhitelist) + dailyAccess 时间窗
 */
export function getCodeDetail(codeId: number | string): Promise<AdoptionCode> {
  return http.get(`/admin/adoption-codes/${codeId}`)
}

export function createPlot(data: AnyReqBody): Promise<Plot> {
  return http.post('/admin/plots', data)
}

/**
 * 地块详情 · 对齐后端 PlotDetailVO (含经纬度 / 封面 / 简介)
 */
export function getPlotDetail(plotId: number | string): Promise<Plot> {
  return http.get(`/admin/plots/${plotId}`)
}

/**
 * 更新地块 · 所有字段可选 (null = 不改)
 * 后端允许: plotName / areaSize / areaUnit / longitude / latitude / plotStatus / liveCoverUrl / introText
 */
export function updatePlot(plotId: number | string, data: AnyReqBody): Promise<Plot> {
  return http.put(`/admin/plots/${plotId}`, data)
}

// ============================================================
//  地块绑定子资源 (5)
// ============================================================

export function bindCamera(plotId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/plots/${plotId}/bind-camera`, data)
}

export function bindActuator(plotId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/plots/${plotId}/bind-actuator`, data)
}

export function retireActuatorDevice(deviceId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/actuator-devices/${deviceId}/retire`, data)
}

export function bindSensor(plotId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/plots/${plotId}/bind-sensor`, data)
}

export function retireSensorDevice(sensorId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/sensor-devices/${sensorId}/retire`, data)
}

export function createCropBatch(plotId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/plots/${plotId}/crop-batches`, data)
}

export function bindScreen(plotId: number | string, data: AnyReqBody): Promise<unknown> {
  return http.post(`/admin/plots/${plotId}/bind-screen`, data)
}

// ============================================================
//  大屏管理 (3)
// ============================================================

export function listScreens(params?: PageQuery): Promise<PaginatedList<Screen>> {
  return http.get('/admin/screens', { params })
}

export function deleteScreen(screenId: number | string): Promise<unknown> {
  return http.delete(`/admin/screens/${screenId}`)
}

export function regenerateScreenToken(screenId: number | string): Promise<Screen> {
  return http.post(`/admin/screens/${screenId}/regenerate-token`)
}

// ============================================================
//  设备数据查看 (4)
// ============================================================

export function getDeviceOverview(): Promise<DeviceOverview> {
  return http.get('/admin/device-overview')
}

export function listSensorDevices(params?: PageQuery): Promise<PaginatedList<SensorDevice>> {
  return http.get('/admin/sensor-devices', { params })
}

export function listSensorData(
  sensorId: number | string,
  params?: PageQuery,
): Promise<PaginatedList<SensorDataPoint>> {
  return http.get(`/admin/sensor-devices/${sensorId}/data`, { params })
}

export function getPlotSensorOverview(plotId: number | string): Promise<PlotSensorOverview> {
  return http.get(`/admin/plots/${plotId}/sensor-overview`)
}

// ============================================================
//  摄像头管理 (3)
// ============================================================

export function listCameras(params?: PageQuery): Promise<PaginatedList<Camera>> {
  return http.get('/admin/cameras', { params })
}

export function updateCamera(cameraId: number | string, data: AnyReqBody): Promise<Camera> {
  return http.put(`/admin/cameras/${cameraId}`, data)
}

export function deleteCamera(cameraId: number | string): Promise<unknown> {
  return http.delete(`/admin/cameras/${cameraId}`)
}

// ============================================================
//  状态变更 / 详情 (5)
// ============================================================

export function updateOrderStatus(
  orderId: number | string,
  data: AnyReqBody,
): Promise<AdoptionOrder> {
  return http.put(`/admin/adoption-orders/${orderId}/status`, data)
}

export function revokeCode(codeId: number | string, data: AnyReqBody): Promise<AdoptionCode> {
  return http.post(`/admin/adoption-codes/${codeId}/revoke`, data)
}

export function getDeviceDetail(deviceId: number | string): Promise<ActuatorDevice> {
  return http.get(`/admin/actuator-devices/${deviceId}`)
}

export function unlockDevice(
  deviceId: number | string,
  data: AnyReqBody,
): Promise<ActuatorDevice> {
  return http.post(`/admin/actuator-devices/${deviceId}/unlock`, data)
}

export function takeoverTask(
  taskId: number | string,
  data: AnyReqBody,
): Promise<OperationTask> {
  return http.post(`/admin/operation-tasks/${taskId}/takeover`, data)
}

export function bindOperatorPlotScope(
  operatorUserId: number | string,
  plotId: number | string,
  data?: { isPrimary?: 0 | 1 },
): Promise<unknown> {
  return http.post(`/admin/operators/${operatorUserId}/plots/${plotId}/bind`, data ?? {})
}

export function unbindOperatorPlotScope(
  operatorUserId: number | string,
  plotId: number | string,
): Promise<unknown> {
  return http.post(`/admin/operators/${operatorUserId}/plots/${plotId}/unbind`)
}

export function listOperatorPlotScopes(
  operatorUserId: number | string,
  params?: PageQuery,
): Promise<PaginatedList<Record<string, unknown>>> {
  return http.get(`/admin/operators/${operatorUserId}/plots`, { params })
}
