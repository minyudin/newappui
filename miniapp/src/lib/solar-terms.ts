/**
 * 二十四节气 · 七十二候 · Solar Terms
 * ============================================================
 *  给定日期返回当前节气 + 七十二候 + 季节 + 主题色种子.
 *
 *  设计意图 · "《农政全书》书页 volume mark":
 *    登录页/认养页 lede 下方放一行 "〈 立夏 · 蝼蝈鸣 〉",
 *    并把 season → CSS variable 注入到全站, 让 app 在不同月份打开长得不一样.
 *
 *  精度: ±1 天 (不对接紫金山天文台真精确日期, 足以做 UI 时节呼应).
 * ============================================================ */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SolarTerm {
  /** 节气名, 如 "立夏" */
  name: string
  /** 配套农谚, 短句, 不超过 12 字 */
  saying: string
  /** 节气开始的 (月份 · 月内日期) · 公历 */
  month: number
  day: number
  /** 季节归属 */
  season: Season
  /** 七十二候 · 一节三候 (每候约 5 天) · 用古籍原文 */
  pentads: [string, string, string]
}

// 按公历从 1/1 往后排序 · 方便"找今天所在的节气"反向遍历
const TERMS: SolarTerm[] = [
  { month: 1,  day: 6,  name: '小寒', saying: '雁北乡',           season: 'winter', pentads: ['雁北乡', '鹊始巢', '雉始雊'] },
  { month: 1,  day: 20, name: '大寒', saying: '极寒将尽',         season: 'winter', pentads: ['鸡始乳', '征鸟厉疾', '水泽腹坚'] },
  { month: 2,  day: 4,  name: '立春', saying: '一年之计在于春',   season: 'spring', pentads: ['东风解冻', '蛰虫始振', '鱼陟负冰'] },
  { month: 2,  day: 19, name: '雨水', saying: '春雨贵如油',       season: 'spring', pentads: ['獭祭鱼', '候雁北', '草木萌动'] },
  { month: 3,  day: 6,  name: '惊蛰', saying: '春雷响 万物长',    season: 'spring', pentads: ['桃始华', '仓庚鸣', '鹰化为鸠'] },
  { month: 3,  day: 21, name: '春分', saying: '昼夜平分',         season: 'spring', pentads: ['玄鸟至', '雷乃发声', '始电'] },
  { month: 4,  day: 5,  name: '清明', saying: '清明前后 种瓜点豆', season: 'spring', pentads: ['桐始华', '田鼠化为鴽', '虹始见'] },
  { month: 4,  day: 20, name: '谷雨', saying: '雨生百谷',         season: 'spring', pentads: ['萍始生', '鸣鸠拂其羽', '戴胜降于桑'] },
  { month: 5,  day: 6,  name: '立夏', saying: '夏始于此',         season: 'summer', pentads: ['蝼蝈鸣', '蚯蚓出', '王瓜生'] },
  { month: 5,  day: 21, name: '小满', saying: '麦粒将熟',         season: 'summer', pentads: ['苦菜秀', '靡草死', '麦秋至'] },
  { month: 6,  day: 6,  name: '芒种', saying: '有芒之谷可稼种',   season: 'summer', pentads: ['螳螂生', '鵙始鸣', '反舌无声'] },
  { month: 6,  day: 21, name: '夏至', saying: '夏之极也',         season: 'summer', pentads: ['鹿角解', '蜩始鸣', '半夏生'] },
  { month: 7,  day: 7,  name: '小暑', saying: '温风至',           season: 'summer', pentads: ['温风至', '蟋蟀居壁', '鹰始鸷'] },
  { month: 7,  day: 23, name: '大暑', saying: '腐草为萤',         season: 'summer', pentads: ['腐草为萤', '土润溽暑', '大雨时行'] },
  { month: 8,  day: 8,  name: '立秋', saying: '凉风至',           season: 'autumn', pentads: ['凉风至', '白露降', '寒蝉鸣'] },
  { month: 8,  day: 23, name: '处暑', saying: '暑气止',           season: 'autumn', pentads: ['鹰乃祭鸟', '天地始肃', '禾乃登'] },
  { month: 9,  day: 8,  name: '白露', saying: '蒹葭苍苍',         season: 'autumn', pentads: ['鸿雁来', '玄鸟归', '群鸟养羞'] },
  { month: 9,  day: 23, name: '秋分', saying: '平分秋色',         season: 'autumn', pentads: ['雷始收声', '蛰虫坯户', '水始涸'] },
  { month: 10, day: 8,  name: '寒露', saying: '露凝而寒',         season: 'autumn', pentads: ['鸿雁来宾', '雀入大水为蛤', '菊有黄华'] },
  { month: 10, day: 24, name: '霜降', saying: '霜始降',           season: 'autumn', pentads: ['豺乃祭兽', '草木黄落', '蜇虫咸俯'] },
  { month: 11, day: 8,  name: '立冬', saying: '冬藏之始',         season: 'winter', pentads: ['水始冰', '地始冻', '雉入大水为蜃'] },
  { month: 11, day: 22, name: '小雪', saying: '初雪渐至',         season: 'winter', pentads: ['虹藏不见', '天气上升', '闭塞而成冬'] },
  { month: 12, day: 7,  name: '大雪', saying: '雪盛',             season: 'winter', pentads: ['鹖鴠不鸣', '虎始交', '荔挺出'] },
  { month: 12, day: 22, name: '冬至', saying: '一阳生',           season: 'winter', pentads: ['蚯蚓结', '麋角解', '水泉动'] },
]

/**
 * 取 "now 所在的当前节气".
 *  从列表尾 (12月冬至) 往前找, 第一个开始日 ≤ 今天的节气.
 *  月初早于 1/6 小寒 → 回退到上一年的大寒 (跨年兼容).
 */
export function getCurrentSolarTerm(now: Date = new Date()): SolarTerm {
  const m = now.getMonth() + 1
  const d = now.getDate()

  for (let i = TERMS.length - 1; i >= 0; i--) {
    const t = TERMS[i]
    if (t.month < m || (t.month === m && t.day <= d)) {
      return t
    }
  }
  return TERMS[TERMS.length - 1]
}

/** 取当前节气在 24 节气中的序号 (立春为 03, 因为列表从小寒开始) */
export function getCurrentTermOrdinal(now: Date = new Date()): number {
  const cur = getCurrentSolarTerm(now)
  const idx = TERMS.findIndex((t) => t.name === cur.name)
  return idx + 1
}

/** 当前节气下"第几候" (1/2/3) · 用于配章首引言 */
export function getCurrentPentad(now: Date = new Date()): { index: 1 | 2 | 3; name: string; term: SolarTerm } {
  const cur = getCurrentSolarTerm(now)
  // 节气开始日 → now 之间相差几天
  const startThisYear = new Date(now.getFullYear(), cur.month - 1, cur.day)
  let diff = Math.floor((now.getTime() - startThisYear.getTime()) / (24 * 3600 * 1000))
  if (diff < 0) diff += 365 // 跨年节气兜底
  const idx = (diff < 5 ? 1 : diff < 10 ? 2 : 3) as 1 | 2 | 3
  return { index: idx, name: cur.pentads[idx - 1], term: cur }
}

/** 取 next solar term (用于 "距下一个节气 X 天" 类提示) */
export function getNextSolarTerm(now: Date = new Date()): SolarTerm {
  const current = getCurrentSolarTerm(now)
  const idx = TERMS.findIndex((t) => t.name === current.name)
  return TERMS[(idx + 1) % TERMS.length]
}

/* ============================================================
 *  季节 → 主题色映射
 *  注入到 :root 后, 全站主按钮 / 章节高亮线 / sparkline 末端
 *  / progress bar / 节气印章 全部跟随
 * ============================================================ */
export interface SeasonTheme {
  accent: string       // 主 accent 色 (按钮 / 高亮)
  accentSoft: string   // 柔化, 用于 hover / 选中态背景
  accentInk: string    // 印章用的更深一档
  paper: string        // 略加色温的纸底, 用于 hero 章页
  ink: string          // 文字色, 通常不变, 但秋冬可以微暖
}

const THEMES: Record<Season, SeasonTheme> = {
  spring: {
    accent:     '#3d5a3f', // farm-green
    accentSoft: '#cad8c2',
    accentInk:  '#2d4030',
    paper:      '#eceae1',
    ink:        '#2d2a26',
  },
  summer: {
    accent:     '#7d8a5a', // 深 moss
    accentSoft: '#cdd5b3',
    accentInk:  '#5a6740',
    paper:      '#ebebe0',
    ink:        '#2d2a26',
  },
  autumn: {
    accent:     '#6b5537', // farm-earth
    accentSoft: '#d6c6a8',
    accentInk:  '#4d3c25',
    paper:      '#eee7d8',
    ink:        '#2d2520',
  },
  winter: {
    accent:     '#3a546e', // 深 slate
    accentSoft: '#c5d2dd',
    accentInk:  '#2a3d52',
    paper:      '#e6e8eb',
    ink:        '#22252a',
  },
}

export function getSeasonTheme(season: Season): SeasonTheme {
  return THEMES[season]
}

/**
 * 把当前节气主题写到 document.documentElement 的 CSS 变量上.
 * Taro H5 / 浏览器环境调用; weapp 端不存在 document, 静默跳过.
 */
export function applySeasonTheme(now: Date = new Date()): SeasonTheme | null {
  const term = getCurrentSolarTerm(now)
  const theme = getSeasonTheme(term.season)

  if (typeof document === 'undefined' || !document.documentElement) return theme

  const root = document.documentElement
  root.style.setProperty('--accent-current',     theme.accent)
  root.style.setProperty('--accent-current-soft', theme.accentSoft)
  root.style.setProperty('--accent-current-ink', theme.accentInk)
  root.style.setProperty('--paper-current',      theme.paper)
  root.style.setProperty('--season-current',     term.season)
  root.style.setProperty('--term-name',          `"${term.name}"`)
  root.dataset.season = term.season
  root.dataset.term = term.name

  return theme
}
