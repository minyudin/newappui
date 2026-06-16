/**
 * API 类型定义
 * ============================================================
 *  统一响应包络 · 分页结构 · 业务实体 DTO · 请求/响应
 *  对齐 longarch-admin (旧版) + longarch-server 后端契约
 * ============================================================ */

// ============================================================
//  1. 统一响应包络 · 与后端 /api/v1 契约一致
// ============================================================
export interface ApiEnvelope<T = unknown> {
  code: number
  message: string
  data: T
  requestId?: string
  serverTime?: string
}

// ============================================================
//  2. 分页结构 · 与后端固定字段一致
// ============================================================
export interface PaginatedList<T> {
  list: T[]
  total: number
  pageNo: number
  pageSize: number
}

export interface PageQuery {
  pageNo?: number
  pageSize?: number
  [key: string]: unknown
}

// ============================================================
//  3. 公开配置 (GET /public/config · 无需认证)
// ============================================================
export interface PlatformConfig {
  platformName: string
  dashboardTitle: string
  dashboardSubtitle: string
}

// ============================================================
//  4. 角色 · 认证 (对齐后端 UserInfoVO / WechatLoginVO)
// ============================================================
export type RoleType = 'admin' | 'adopter' | 'operator' | 'agronomist'

export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'

/**
 * 当前登录用户 (由 /auth/dev-login · /users/me 等返回)
 * 对齐后端 UserInfoVO
 */
export interface UserInfo {
  userId: number
  userNo: string
  nickname: string
  realName?: string | null
  mobile?: string | null
  avatarUrl?: string | null
  roleType: RoleType
  status: number
  bindMobile?: boolean
  roleProfile?: {
    roleName: string
    roleDesc: string
  }
  permissions?: Record<string, boolean>
  menuScopes?: string[]
  [key: string]: unknown
}

export interface DevLoginReq {
  openId: string
}

/**
 * 管理员后台密码登录请求
 * 对齐后端 AdminLoginReq (mobile + password)
 */
export interface AdminLoginReq {
  mobile: string
  password: string
}

/**
 * 登录响应 · 对齐后端 WechatLoginVO
 * (dev-login / admin-login 复用同一个 VO)
 */
export interface DevLoginRes {
  token: string
  refreshToken?: string
  expiresIn?: number
  userInfo: UserInfo
}

/** adminLogin 响应 · 复用 DevLoginRes 结构 */
export type AdminLoginRes = DevLoginRes

export interface CreateUserReq {
  openId: string
  nickname: string
  roleType: RoleType
}

/**
 * 管理后台用户列表项 · 对齐后端 UserListVO
 * 与 UserInfo 不同: 含 openId / createdAt / 不含 avatarUrl / permissions 等
 */
export interface AdminUser {
  userId: number
  userNo: string
  openId: string
  nickname: string
  realName?: string | null
  mobile?: string | null
  roleType: RoleType
  status: number
  bindMobile?: number
  createdAt: string
  [key: string]: unknown
}

// ============================================================
//  5. 业务实体 (P5 逐页细化)
//     目前保留最小可用字段 + index signature 以便扩展
// ============================================================

/** 认养订单 */
export interface AdoptionOrder {
  orderId: number
  orderStatus: 'pending' | 'active' | 'completed' | 'cancelled' | string
  userId?: number
  userName?: string
  userNickname?: string
  userMobile?: string
  plotId?: number
  plotNo?: string
  plotName?: string
  plotTitle?: string
  orderNo?: string
  adoptionType?: string
  payableAmount?: number
  createdAt?: string
  [key: string]: unknown
}

/** 认养码 */
export interface AdoptionCode {
  codeId: number
  code?: string
  status?: string
  [key: string]: unknown
}

/** 地块 */
export interface Plot {
  plotId: number
  name?: string
  greenhouseNo?: string
  [key: string]: unknown
}

/** 作物批次 */
export interface CropBatch {
  batchId: number
  [key: string]: unknown
}

/** 执行器设备 · 对齐 DeviceListVO */
export interface ActuatorDevice {
  deviceId: number
  deviceNo?: string
  deviceName?: string | null
  deviceType?: string
  deviceStatus?: string
  networkStatus?: string
  lastHeartbeatAt?: string | null
  heartbeatAgeSeconds?: number | null
  lockStatus?: string
  currentTaskId?: number | null
  plotId?: number
  /** 解析后的地块名 */
  plotName?: string | null
  createdAt?: string
  [key: string]: unknown
}

/** 操作任务 · 对齐 TaskListVO */
export interface OperationTask {
  taskId: number
  taskNo?: string
  requestUserId?: number | null
  /** 解析后的申请人昵称 */
  requesterName?: string | null
  plotId?: number | null
  /** 解析后的地块名 */
  plotName?: string | null
  deviceId?: number | null
  /** 解析后的执行设备编号 (SEN-xxx/ACT-xxx) */
  deviceNo?: string | null
  /** 解析后的执行设备名 */
  deviceName?: string | null
  actionType?: string
  priority?: number
  taskStatus: TaskStatus | string
  deviceExecutionState?: string
  failReason?: string | null
  createdAt?: string
  finishedAt?: string | null
  [key: string]: unknown
}

/** 大屏 */
export interface Screen {
  screenId: number
  screenNo?: string
  token?: string
  [key: string]: unknown
}

/** 摄像头 */
export interface Camera {
  cameraId: number
  cameraNo?: string
  plotId?: number
  [key: string]: unknown
}

/** 传感器设备 */
export interface SensorDevice {
  sensorId: number
  deviceNo?: string
  sensorType?: string
  plotId?: number
  [key: string]: unknown
}

/** 传感器数据点 */
export interface SensorDataPoint {
  sampleAt?: string
  [key: string]: unknown
}

/** 设备总览 (GET /admin/device-overview) */
export interface DeviceOverview {
  [key: string]: unknown
}

/** 地块传感器总览 (GET /admin/plots/:plotId/sensor-overview) */
export interface PlotSensorOverview {
  [key: string]: unknown
}
