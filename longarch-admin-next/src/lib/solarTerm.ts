/**
 * 二十四节气 · 七十二候 · admin-next 版
 * ============================================================
 *  与 miniapp/src/lib/solar-terms.ts 等价 (略微精简, 不含主题切换)
 *  用于 TopBar 节气印章 / Wizard 引言
 * ============================================================ */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SolarTerm {
  name: string
  saying: string
  month: number
  day: number
  season: Season
  pentads: [string, string, string]
}

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

export function getCurrentSolarTerm(now: Date = new Date()): SolarTerm {
  const m = now.getMonth() + 1
  const d = now.getDate()
  for (let i = TERMS.length - 1; i >= 0; i--) {
    const t = TERMS[i]
    if (t.month < m || (t.month === m && t.day <= d)) return t
  }
  return TERMS[TERMS.length - 1]
}

export function getCurrentPentad(now: Date = new Date()): { index: 1 | 2 | 3; name: string; term: SolarTerm } {
  const cur = getCurrentSolarTerm(now)
  const startThisYear = new Date(now.getFullYear(), cur.month - 1, cur.day)
  let diff = Math.floor((now.getTime() - startThisYear.getTime()) / (24 * 3600 * 1000))
  if (diff < 0) diff += 365
  const idx = (diff < 5 ? 1 : diff < 10 ? 2 : 3) as 1 | 2 | 3
  return { index: idx, name: cur.pentads[idx - 1], term: cur }
}

export interface SeasonTheme {
  accent: string
  accentSoft: string
  accentInk: string
}

const THEMES: Record<Season, SeasonTheme> = {
  spring: { accent: '#3d5a3f', accentSoft: '#cad8c2', accentInk: '#2d4030' },
  summer: { accent: '#7d8a5a', accentSoft: '#cdd5b3', accentInk: '#5a6740' },
  autumn: { accent: '#6b5537', accentSoft: '#d6c6a8', accentInk: '#4d3c25' },
  winter: { accent: '#3a546e', accentSoft: '#c5d2dd', accentInk: '#2a3d52' },
}

export function getSeasonTheme(season: Season): SeasonTheme {
  return THEMES[season]
}

export function applySeasonTheme(now: Date = new Date()): SeasonTheme {
  const term = getCurrentSolarTerm(now)
  const theme = THEMES[term.season]
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement
    root.style.setProperty('--accent-current', theme.accent)
    root.style.setProperty('--accent-current-soft', theme.accentSoft)
    root.style.setProperty('--accent-current-ink', theme.accentInk)
    root.dataset.season = term.season
    root.dataset.term = term.name
  }
  return theme
}
