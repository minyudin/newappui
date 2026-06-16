/**
 * Miniapp · Type Definitions
 * ============================================================
 *  与 longarch-admin-next/src/types 保持一致, 保证前后端一体
 * ============================================================ */

export type RoleType =
  | 'adopter'
  | 'guest'
  | 'admin'
  | 'operator'
  | 'agronomist'
  | 'ai_agent'
  | 'edge_node'

export interface RoleProfile {
  roleName: string
  roleDesc: string
}

export interface UserInfo {
  userId: number
  userNo: string
  nickname: string
  realName?: string
  mobile?: string
  avatarUrl?: string
  roleType: RoleType
  status: number
  bindMobile: boolean
  /**
   * 是否已设置昵称 · 等价于 user.nickname IS NOT NULL.
   * 微信新用户登录后必须先调 setupNickname 才能进业务, 这字段用于判跳"补昵称"页.
   */
  bindNickname?: boolean
  roleProfile?: RoleProfile
  permissions?: Record<string, boolean>
  menuScopes?: string[]
}

export interface LoginResponse {
  token: string
  refreshToken: string
  expiresIn: number
  userInfo: UserInfo
}

export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
  requestId?: string
  serverTime?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  pageNo: number
  pageSize: number
}

// ---- 订单状态 ----
export type OrderStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'paid'

// ---- 我的认养列表项 (对应后端 AdoptionListVO) ----
export interface AdoptionListItem {
  orderId: number
  orderNo: string
  plotId: number
  plotName: string | null
  cropBatchId: number | null
  cropName: string | null
  varietyName: string | null
  growthStage: string | null
  coverUrl: string | null
  /** 契约上应有；若后端/网关异常为空，前端须容错避免列表渲染崩溃 */
  startAt?: string | null
  endAt?: string | null
  orderStatus: OrderStatus
}

// ---- 认养详情 (对应后端 AdoptionDetailVO) ----
export interface AdoptionDetail {
  orderId: number
  orderNo: string
  plotId: number
  plotName: string | null
  cropBatchId: number | null
  cropName: string | null
  varietyName: string | null
  adoptionType: string
  startAt: string
  endAt: string
  orderStatus: OrderStatus
  visibilityLevel: string
  operationLevel: string
}

// ---- 操作任务 ----
export type TaskStatusValue =
  | 'pending'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'

export type DeviceExecutionState =
  | 'submitted'
  | 'dispatched'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

/** 允许的动作 · 从 /plots/{plotId}/allowed-actions 拉 */
export interface AllowedAction {
  actionType: string
  actionName: string
  enabled: boolean
  reason: string
  deviceId: number | null
  deviceName: string | null
  requiredParams: string[]
  optionalParams: string[]
}

export interface AllowedActionsResponse {
  plotId: number
  actions: AllowedAction[]
  /** 今日允许操作的最大次数 (来自分享码 / 认养码的 maxDailyOperations) */
  dailyLimit?: number | null
  /** 今日已用次数 */
  dailyUsed?: number | null
  /** 今日剩余次数 = max(0, dailyLimit - dailyUsed) */
  dailyRemaining?: number | null
}

/** 创建任务请求 */
export interface CreateTaskReq {
  plotId: number
  deviceId: number
  actionType: string
  actionParams: Record<string, unknown>
  schedulingMode: 'asap' | 'scheduled' | string
  expectedExecuteAt?: string
  idempotencyKey: string
  dispatchMode?: 'auto' | 'direct_operator' | string
  directOperatorReason?: string
}

export interface CreateTaskResponse {
  taskId: number
  taskNo: string
  taskStatus: TaskStatusValue
  queueNo: number | null
  estimatedWaitMinutes: number | null
  deviceExecutionState: DeviceExecutionState
  message: string | null
}

/** 我的任务 列表项 */
export interface OperationTaskListItem {
  taskId: number
  taskNo: string
  plotId: number
  plotName: string | null
  actionType: string
  actionName: string
  taskStatus: TaskStatusValue
  deviceExecutionState: DeviceExecutionState
  queueNo: number | null
  createdAt: string
}

/** 任务详情 */
export interface OperationTaskDetail {
  taskId: number
  taskNo: string
  requestUserId: number
  plotId: number
  deviceId: number
  actionType: string
  actionName: string
  schedulingMode: string
  priority: number
  taskStatus: TaskStatusValue
  deviceExecutionState: DeviceExecutionState
  queueNo: number | null
  estimatedWaitMinutes: number | null
  failReason: string | null
  createdAt: string
  queuedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  cancelable: boolean
  /** 运营审核链路 · 后端 TaskDetailVO 的 reviewState (none / operator_required / approved / rejected) */
  reviewState?: string | null
  /** 风险级别 low/medium/high, 由后端风险门控写入 */
  riskLevel?: string | null
  /** 命中的风险标签 (逗号分隔字符串, 后端原样透传) */
  riskReasons?: string | null
  /** 认领该任务的运营员 userId, null 表示未被任何人认领 */
  assigneeUserId?: number | null
}

/** 轮询排队状态 */
export interface QueueStatus {
  taskId: number
  taskStatus: TaskStatusValue
  queueNo: number | null
  estimatedWaitMinutes: number | null
}

export interface CancelTaskResponse {
  taskId: number
  taskStatus: TaskStatusValue
  cancelled: boolean
}

// ---- 认养码权限 ----
export interface AccessPermissions {
  canViewLive: boolean
  canViewHistory: boolean
  historyDays: number | null
  canViewSensor: boolean
  canOperate: boolean
  operationWhitelist: string[]
  maxDailyOperations: number | null
  shareable: boolean
}

// ---- verify 响应 ----
export interface VerifyCodeResponse {
  valid: boolean
  codeType: 'master' | 'guest' | 'share' | string
  status: string
  orderId: number
  plotId: number
  cropBatchId: number | null
  validFrom: string
  validTo: string
  dailyAccessStart: string | null
  dailyAccessEnd: string | null
  permissions: AccessPermissions
}

// ---- redeem 响应 ----
export interface RedeemCodeResponse {
  redeemed: boolean
  orderId: number
  plotId: number
  bindUserId: number
}

// ---- 分享码 ----
export interface ShareCodeItem {
  codeId: number
  code: string
  codeType: 'share' | string
  plotId: number
  orderId: number
  createdByUserId: number
  bindUserId: number | null
  status: 'active' | 'revoked' | string
  validFrom: string
  validTo: string
  dailyAccessStart: string | null
  dailyAccessEnd: string | null
  canViewLive: number
  canViewHistory: number
  historyDays: number
  canViewSensor: number
  canOperate: number
  operationWhitelist: string
  maxDailyOperations: number
  createdAt: string
}

// ---- 地块详情 (API-09) ----
export interface PlotDetail {
  plotId: number
  plotNo: string
  plotName: string
  farmId: number | null
  farmName: string | null
  areaSize: number | string
  areaUnit: string
  longitude: number | string | null
  latitude: number | string | null
  plotStatus: string
  liveCoverUrl: string | null
  introText: string | null
  currentCropBatch: CurrentCropBatch | null
}

export interface CurrentCropBatch {
  cropBatchId: number
  batchNo: string
  cropName: string | null
  varietyName: string | null
  growthStage: string | null
  sowingAt: string | null
  expectedHarvestAt: string | null
}

// ---- 作物批次详情 (API-10) ----
export interface CropBatchDetail {
  cropBatchId: number
  batchNo: string
  cropName: string
  varietyName: string | null
  growthStage: string | null
  batchStatus: string
  sowingAt: string | null
  expectedHarvestAt: string | null
  agronomyPlan: {
    nextTask: string | null
    riskHint: string | null
  } | null
}

// ---- 摄像头 (API-13) ----
export interface Camera {
  cameraId: number
  deviceNo: string
  cameraName: string | null
  streamProtocol: string | null
  playbackEnabled: boolean
  ptzEnabled: boolean
  micEnabled: boolean
  networkStatus: string
  deviceStatus: string
  /** SRS 截图 URL, 可直接塞 <Image src=...> */
  snapshotUrl: string | null
}

// ---- 实时流地址 (API-14) ----
export interface LiveUrl {
  cameraId: number
  protocol: string
  /** HTTP-FLV 低延迟, H5 用 flv.js 播 */
  flvUrl: string | null
  /** HLS 兼容性好, iOS Safari 原生支持 */
  hlsUrl: string | null
  expireAt: string | null
  networkStatus: string
  degradeStrategy: {
    supportsLowBitrate: boolean
    supportsSnapshotFallback: boolean
  } | null
}

// ---- 历史回放地址 (API-15) ----
export interface PlaybackUrl {
  cameraId: number
  playbackUrl: string
  startTime: string
  endTime: string
}

// ---- 快照 (API-16) ----
export interface Snapshot {
  cameraId: number
  snapshotUrl: string
  capturedAt: string
}

// ---- 传感器 (API-17) ----
export interface Sensor {
  sensorId: number
  deviceNo: string
  sensorType: string
  sensorName: string | null
  unit: string | null
  status: string
  lastValue: number | string | null
  lastSampleAt: string | null
  /** 大类: environment / soil / 后端返的字段, 用来在 PlotMicroBar 优先取环境传感器 */
  category?: string | null
}

// ---- 传感器摘要 (API-18) ----
export interface SensorSummary {
  plotId: number
  summary: Array<{
    sensorType: string
    label: string | null
    value: number | string | null
    unit: string | null
    sampleAt: string | null
  }>
}

// ---- 传感器历史曲线 (API-19) ----
export interface SensorHistory {
  sensorId: number
  sensorType: string | null
  series?: Array<{
    metricKey: string
    points: Array<{
      sampleAt: string
      value: number | string
    }>
  }>
  points: Array<{
    sampleAt: string
    value: number | string
  }>
}

// ---- 农事记录 (API-11) ----
export interface FarmingRecord {
  recordId: number
  recordType: string
  recordTitle: string
  operatorName: string | null
  recordTime: string | null
  description: string | null
}

// ---- AI 对话 (API-26) ----
export interface AiChatReq {
  sessionId: string
  plotId: number
  message: string
}

export interface AiGeneralChatReq {
  sessionId: string
  message: string
}

export type AiRiskLevel = 'low' | 'medium' | 'high' | string

export interface AiChatResponse {
  sessionId: string
  intent: string
  targetPlotId: number
  targetDeviceId: number | null
  action: string | null
  params: Record<string, unknown> | null
  needConfirm: boolean
  permissionCheck: boolean
  schedulingMode: string | null
  riskLevel: AiRiskLevel
  reply: string
  suggestion: string | null
}

// ---- AI 创建任务 (API-27) ----
export interface AiCreateTaskReq {
  sessionId: string
  plotId: number
  deviceId: number
  actionType: string
  actionParams?: Record<string, unknown>
}

export interface AiCreateTaskResponse {
  taskId: number
  taskNo: string
  taskStatus: TaskStatusValue
  queueNo: number | null
  estimatedWaitMinutes: number | null
  deviceExecutionState: DeviceExecutionState
  message: string | null
}

// ---- AI 分析结论 ----
export interface AiAnalysis {
  id: number
  plotId: number
  analysisType: 'manual' | 'periodic' | string
  sensorSnapshot: Array<Record<string, unknown>>
  cropInfo: string | null
  analysisResult: string
  riskLevel: AiRiskLevel
  suggestedActions: string[]
  createdAt: string | null
}
