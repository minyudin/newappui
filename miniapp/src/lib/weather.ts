import Taro from '@tarojs/taro'

/**
 * 天气 · 按用户真实定位查询
 *  · wx.getLocation 取坐标 (拒绝授权/失败时回退兰州)
 *  · Open-Meteo 免费接口查实时天气 (无需 key)
 *  · BigDataCloud 免费反向地理编码取城市名 (无需 key)
 *  · 结果缓存 30 分钟, 失败时静默返回 null
 */

export interface WeatherNow {
  temp: number
  text: string
  city: string | null
}

// 回退坐标: 兰州
const FALLBACK_LAT = 36.06
const FALLBACK_LON = 103.83

// WMO weather code → 中文
const WMO_TEXT: Array<[number[], string]> = [
  [[0], '晴'],
  [[1, 2], '多云'],
  [[3], '阴'],
  [[45, 48], '雾'],
  [[51, 53, 55, 56, 57], '毛毛雨'],
  [[61, 63, 65, 66, 67], '雨'],
  [[71, 73, 75, 77], '雪'],
  [[80, 81, 82], '阵雨'],
  [[85, 86], '阵雪'],
  [[95, 96, 99], '雷雨'],
]

function codeToText(code: number): string {
  for (const [codes, text] of WMO_TEXT) {
    if (codes.includes(code)) return text
  }
  return '多云'
}

async function getUserCoords(): Promise<{ lat: number; lon: number }> {
  try {
    const loc = await Taro.getLocation({ type: 'wgs84' })
    if (loc?.latitude != null && loc?.longitude != null) {
      return { lat: loc.latitude, lon: loc.longitude }
    }
  } catch {
    // 用户拒绝授权 / 定位失败 → 回退
  }
  return { lat: FALLBACK_LAT, lon: FALLBACK_LON }
}

async function reverseCity(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await Taro.request<{
      city?: string
      locality?: string
      principalSubdivision?: string
    }>({
      url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`,
      method: 'GET',
      timeout: 5000,
    })
    const d = res.data
    return d?.city || d?.locality || d?.principalSubdivision || null
  } catch {
    return null
  }
}

let cached: WeatherNow | null = null
let cachedAt = 0

export async function getWeatherNow(): Promise<WeatherNow | null> {
  if (cached && Date.now() - cachedAt < 30 * 60_000) return cached
  try {
    const { lat, lon } = await getUserCoords()
    const [res, city] = await Promise.all([
      Taro.request<{
        current?: { temperature_2m?: number; weather_code?: number }
      }>({
        url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`,
        method: 'GET',
        timeout: 5000,
      }),
      reverseCity(lat, lon),
    ])
    const cur = res.data?.current
    if (cur?.temperature_2m == null) return cached
    cached = {
      temp: Math.round(cur.temperature_2m),
      text: codeToText(cur.weather_code ?? 1),
      city,
    }
    cachedAt = Date.now()
    return cached
  } catch {
    return cached
  }
}
