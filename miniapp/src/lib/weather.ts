import Taro from '@tarojs/taro'

/**
 * 天气 · Open-Meteo 免费接口 (无需 key)
 *  · 默认坐标: 兰州 (陇上示范农场所在区域)
 *  · 结果缓存 30 分钟, 失败时静默返回 null
 */

export interface WeatherNow {
  temp: number
  text: string
}

const LAT = 36.06
const LON = 103.83

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

let cached: WeatherNow | null = null
let cachedAt = 0

export async function getWeatherNow(): Promise<WeatherNow | null> {
  if (cached && Date.now() - cachedAt < 30 * 60_000) return cached
  try {
    const res = await Taro.request<{
      current?: { temperature_2m?: number; weather_code?: number }
    }>({
      url: `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`,
      method: 'GET',
      timeout: 5000,
    })
    const cur = res.data?.current
    if (cur?.temperature_2m == null) return cached
    cached = {
      temp: Math.round(cur.temperature_2m),
      text: codeToText(cur.weather_code ?? 1),
    }
    cachedAt = Date.now()
    return cached
  } catch {
    return cached
  }
}
