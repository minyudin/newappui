/**
 * 传感器阈值映射 · Sensor Thresholds
 * ============================================================
 *  用于传感器数据的"健康/警戒"可视化:
 *    每个传感器类型有一个 healthy range [safeMin, safeMax]
 *    和一个显示范围 [displayMin, displayMax] 用来画色带刻度.
 *
 *  · value 落在 [safeMin, safeMax] 内 → 数字用墨色
 *  · 超出 → 数字用砖红 (clay)
 *  · 色带指针位置 = (value - displayMin) / (displayMax - displayMin)
 *
 *  未登记的传感器类型 → resolveThreshold 返回 null, 外层不渲染色带.
 *  经验数据, 非权威农业标准, 供 UI 识别"大致位置" 用.
 * ============================================================ */

export interface SensorThreshold {
  /** 安全区下限 */
  safeMin: number
  /** 安全区上限 */
  safeMax: number
  /** 色带展示范围下限 */
  displayMin: number
  /** 色带展示范围上限 */
  displayMax: number
  /** 色带末端短标签单位, 一般和 sensor_device.unit 对齐 */
  unitHint?: string
}

const THRESHOLDS: Record<string, SensorThreshold> = {
  // 环境 · 气温
  temperature: { safeMin: 15, safeMax: 30, displayMin: 0,  displayMax: 45,  unitHint: '°C' },

  // 环境 · 空气湿度 (%)
  humidity:    { safeMin: 40, safeMax: 75, displayMin: 0,  displayMax: 100, unitHint: '%' },

  // 环境 · CO₂ (ppm)
  co2:         { safeMin: 400, safeMax: 1000, displayMin: 300, displayMax: 2000, unitHint: 'ppm' },

  // 环境 · 光照 (klux) · 注: 后端单位可能是 lux, 跟实际校准
  light:       { safeMin: 10, safeMax: 80, displayMin: 0, displayMax: 120, unitHint: 'klux' },

  // 土壤 · 温度
  soil_temperature: { safeMin: 10, safeMax: 25, displayMin: 0,  displayMax: 40,  unitHint: '°C' },

  // 土壤 · 湿度 (%)
  soil_moisture:    { safeMin: 30, safeMax: 70, displayMin: 0,  displayMax: 100, unitHint: '%' },

  // 土壤 · pH · 酸碱度
  soil_ph:          { safeMin: 5.5, safeMax: 7.5, displayMin: 3, displayMax: 10, unitHint: 'pH' },
  ph:               { safeMin: 5.5, safeMax: 7.5, displayMin: 3, displayMax: 10, unitHint: 'pH' },

  // 土壤 · N/P/K (mg/kg, 粗略区间)
  nitrogen:   { safeMin: 80,  safeMax: 200, displayMin: 0, displayMax: 300, unitHint: 'mg/kg' },
  phosphorus: { safeMin: 20,  safeMax: 80,  displayMin: 0, displayMax: 150, unitHint: 'mg/kg' },
  potassium:  { safeMin: 100, safeMax: 250, displayMin: 0, displayMax: 400, unitHint: 'mg/kg' },
}

export function resolveThreshold(sensorType: string | null | undefined): SensorThreshold | null {
  if (!sensorType) return null
  return THRESHOLDS[sensorType] ?? null
}

/** 返回 value 在 display 范围内的百分比 (0-100, 夹紧) · 供色带指针定位 */
export function thresholdCursorPercent(value: number, t: SensorThreshold): number {
  const pct = ((value - t.displayMin) / (t.displayMax - t.displayMin)) * 100
  if (!Number.isFinite(pct)) return 50
  return Math.max(0, Math.min(100, pct))
}

/** 判断 value 是否在安全区 · false 即告警 */
export function isValueSafe(value: number, t: SensorThreshold): boolean {
  return value >= t.safeMin && value <= t.safeMax
}
