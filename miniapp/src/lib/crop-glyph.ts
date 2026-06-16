/**
 * 作物印章字 · Crop Glyph
 * ============================================================
 *  从作物名 (如 "冬小麦" / "马铃薯") 取单字印章字符, 用在认养卡封面.
 *  匹配哲学 · 遵循 Folio 编辑风:
 *    · 用单字"印鉴", 不用卡通图标
 *    · 找作物名中最能代表的 "核心字" (麦/瓜/菜/椒/稻/茄)
 *    · 未识别的作物 → 回退 "田"
 * ============================================================ */

/** 作物核心字映射 · 按优先级查找 · 第一个命中即返回 */
const GLYPH_RULES: Array<{ test: RegExp; glyph: string }> = [
  { test: /小麦|麦/, glyph: '麦' },
  { test: /水稻|稻/, glyph: '稻' },
  { test: /玉米/, glyph: '玉' },
  { test: /高粱/, glyph: '粱' },
  { test: /大豆|黄豆/, glyph: '豆' },
  { test: /马铃薯|土豆/, glyph: '薯' },
  { test: /番茄|西红柿/, glyph: '茄' },
  { test: /黄瓜|青瓜/, glyph: '瓜' },
  { test: /辣椒|青椒/, glyph: '椒' },
  { test: /茄子/, glyph: '茄' },
  { test: /白菜|青菜|油菜|甘蓝/, glyph: '菜' },
  { test: /草莓/, glyph: '莓' },
  { test: /葡萄/, glyph: '葡' },
  { test: /苹果/, glyph: '果' },
  { test: /桃|梨/, glyph: '桃' },
  { test: /西瓜|南瓜|丝瓜|苦瓜|冬瓜/, glyph: '瓜' },
  { test: /韭菜|菠菜/, glyph: '菜' },
  { test: /萝卜/, glyph: '萝' },
  { test: /洋葱|大蒜|葱/, glyph: '葱' },
]

/** 取作物名的印章字 · 无匹配返回 '田' */
export function cropGlyph(cropName: string | null | undefined): string {
  if (!cropName) return '田'
  const name = cropName.trim()
  if (!name) return '田'
  for (const rule of GLYPH_RULES) {
    if (rule.test.test(name)) return rule.glyph
  }
  // 兜底: 取作物名第一个字 (可能是 "茶" / "棉" / "油" 等未列举的, 直接用原字)
  return name[0] || '田'
}
