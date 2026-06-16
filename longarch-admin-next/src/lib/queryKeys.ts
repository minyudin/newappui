/**
 * Query Keys · 集中管理所有 useQuery 的 key
 * ============================================================
 *  规范:
 *   · 第一段 = 业务域 ("users" / "plots" / ...)
 *   · 第二段 = 子资源 或 "list" / "detail"
 *   · 第三段 = 参数对象 (序列化后作为 cache 键的一部分)
 *
 *  使用 invalidateQueries({ queryKey: qk.users.list() }) 做失效
 * ============================================================ */

export const qk = {
  // 公开
  platformConfig: () => ['platform-config'] as const,

  // 当前登录用户 (自己) · 与 admin 用户列表 (qk.users) 隔离
  me: () => ['me'] as const,

  // 用户 / 订单 / 认养码
  users: {
    all: () => ['users'] as const,
    list: (params?: Record<string, unknown>) => ['users', 'list', params] as const,
  },
  orders: {
    all: () => ['orders'] as const,
    list: (params?: Record<string, unknown>) => ['orders', 'list', params] as const,
  },
  codes: {
    all: () => ['codes'] as const,
    list: (params?: Record<string, unknown>) => ['codes', 'list', params] as const,
  },

  // 地块 / 作物
  plots: {
    all: () => ['plots'] as const,
    list: (params?: Record<string, unknown>) => ['plots', 'list', params] as const,
    overview: (plotId: number | string) => ['plots', 'overview', plotId] as const,
  },

  // 设备 · 状态型
  devices: {
    all: () => ['devices'] as const,
    list: (params?: Record<string, unknown>) => ['devices', 'list', params] as const,
    detail: (deviceId: number | string) => ['devices', 'detail', deviceId] as const,
    overview: () => ['devices', 'overview'] as const,
  },
  tasks: {
    all: () => ['tasks'] as const,
    list: (params?: Record<string, unknown>) => ['tasks', 'list', params] as const,
  },
  operatorScopes: {
    all: () => ['operator-scopes'] as const,
    list: (operatorUserId: number | string, params?: Record<string, unknown>) =>
      ['operator-scopes', 'list', operatorUserId, params] as const,
  },
  screens: {
    all: () => ['screens'] as const,
    list: (params?: Record<string, unknown>) => ['screens', 'list', params] as const,
  },
  cameras: {
    all: () => ['cameras'] as const,
    list: (params?: Record<string, unknown>) => ['cameras', 'list', params] as const,
  },

  // 传感器 · 实时型
  sensors: {
    all: () => ['sensors'] as const,
    list: (params?: Record<string, unknown>) => ['sensors', 'list', params] as const,
    data: (sensorId: number | string, params?: Record<string, unknown>) =>
      ['sensors', 'data', sensorId, params] as const,
  },
}
