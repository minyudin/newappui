import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, usePullDownRefresh, usePageScroll } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { usePageRefresh } from '@/hooks/usePageRefresh'
import GrowthStageBar from '@/components/GrowthStageBar'
import {
  resolveThreshold,
  thresholdCursorPercent,
  isValueSafe,
} from '@/lib/sensor-thresholds'
import {
  getPlotDetail,
  getSensorSummary,
  getSensorList,
  getFarmingRecords,
  getOperationLogs,
} from '@/api/plot'
import { getLatestAnalysis, triggerAnalysis } from '@/api/ai'
import { useAuthStore } from '@/store/auth'
import { getCurrentPentad } from '@/lib/solar-terms'
import type {
  PlotDetail,
  Sensor,
  SensorSummary,
  FarmingRecord,
  OperationTaskListItem,
  TaskStatusValue,
  AiAnalysis,
} from '@/types'
import SensorChart from './SensorChart'
import SensorCellSpark from './SensorCellSpark'
import ChapterIndex from '@/components/ChapterIndex'
import SectionFin from '@/components/SectionFin'
import DigitFlipper from '@/components/DigitFlipper'
import PageQuote from '@/components/PageQuote'
import './index.scss'

/**
 * §2 · 地块详情 · Plot Detail
 * ============================================================
 *  入口: /pages/plot/index?plotId=X&plotName=Y
 *
 *  数据:
 *    - GET /plots/{id}                (PlotDetail + currentCropBatch)
 *    - GET /plots/{id}/sensor-summary  (当前传感器读数)
 *    - GET /plots/{id}/farming-records (最近农事)
 *    - GET /plots/{id}/operation-logs  (最近操作)
 *
 *  页面结构:
 *    · 页头 (封面印章)
 *    · 作物批次块
 *    · 传感器当前值网格
 *    · 传感器历史折线 (SensorChart)
 *    · 最近农事 hairline 列表
 *    · 最近操作 hairline 列表
 *    · 底部 CTA: 申请操作 → /pages/task
 * ============================================================ */

const TASK_STATUS_LABEL: Record<TaskStatusValue, { text: string; tone: string }> = {
  pending: { text: '待处理', tone: 'sand' },
  queued: { text: '已排队', tone: 'fog' },
  running: { text: '执行中', tone: 'sage' },
  success: { text: '已完成', tone: 'sage' },
  failed: { text: '已失败', tone: 'clay' },
  cancelled: { text: '已取消', tone: 'ink-faint' },
}

export default function PlotPage() {
  const router = useRouter()
  const plotId = Number(router.params.plotId || 0)

  let plotNameFromQuery = `地块 #${plotId}`
  if (router.params.plotName) {
    try {
      plotNameFromQuery = decodeURIComponent(router.params.plotName)
    } catch {
      plotNameFromQuery = router.params.plotName
    }
  }

  const [detail, setDetail] = useState<PlotDetail | null>(null)
  const [sensors, setSensors] = useState<SensorSummary | null>(null)
  const [sensorList, setSensorList] = useState<Sensor[]>([])
  const [records, setRecords] = useState<FarmingRecord[]>([])
  const [logs, setLogs] = useState<OperationTaskListItem[]>([])
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  // Chapter index 当前章节 (0~4 对应 §01~§05)
  const [activeChapter, setActiveChapter] = useState(0)
  const roleType = useAuthStore((s) => s.userInfo?.roleType)
  const isGuest = roleType === 'guest'
  // 七十二候: 把当前节气 + 第几候挂到页头, 让"农业 + 时间"叙事到位
  const pentadInfo = useMemo(() => {
    try { return getCurrentPentad() } catch { return null }
  }, [])

  // guest 无"申请操作"和"分享码" CTA, 只剩"问 AI"

  // M4 · ref 瞬时锁 + refresh 代际守卫
  const analyzingRef = useRef(false)
  const refreshSeqRef = useRef(0)
  // 章节滚动 · 用户点 ChapterIndex 时由 onJump 设 true, usePageScroll 期间不再覆盖 activeChapter
  // 防"点 §03 → setActive(2) → 立刻又触发 scroll 事件被 detectActive 改回 0"竞态
  const programmaticScrollRef = useRef(false)
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 点击 ChapterIndex 跳转到对应章节
   *  · 原生 pageScrollTo 需要 scrollTop 数值, 用 createSelectorQuery 拿 #chapter-X 的相对位置
   *  · selectViewport().scrollOffset() 拿当前页面已滚距离, 加上 rect.top 才是绝对 scrollTop
   *  · 减 60 px 留章节标题上方喘息空间
   */
  function scrollToChapter(idx: number) {
    const id = `chapter-${idx + 1}`
    programmaticScrollRef.current = true
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current)
    // pageScrollTo 默认 duration 300, 多给 100ms 缓冲让 scroll 事件全部跑完
    programmaticScrollTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false
    }, 600)

    const query = Taro.createSelectorQuery()
    query.select(`#${id}`).boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((res) => {
      const rect = res?.[0] as { top: number } | null
      const viewport = res?.[1] as { scrollTop: number } | null
      if (!rect || !viewport) return
      const target = Math.max(0, viewport.scrollTop + rect.top - 60)
      Taro.pageScrollTo({ scrollTop: target, duration: 300 })
    })
  }

  // 反向同步: 用户手动滚动时, 计算当前在视口顶部的章节, 高亮对应索引
  // 用户点 ChapterIndex 触发的程序滚动期间不参与 (programmaticScrollRef 锁)
  usePageScroll(({ scrollTop }) => {
    if (programmaticScrollRef.current) return
    const query = Taro.createSelectorQuery()
    query.selectAll('#chapter-1, #chapter-2, #chapter-3, #chapter-4, #chapter-5')
      .boundingClientRect()
    query.exec((res) => {
      const rects = res?.[0] as Array<{ top: number; dataset?: { idx?: string } }>
      if (!rects || rects.length === 0) return
      // 找最靠近视口顶 (offset 100px 标题区) 但仍在视口内或上方的章节
      let active = 0
      for (let i = 0; i < rects.length; i++) {
        if (rects[i].top - 100 <= 0) active = i
      }
      // scrollTop 也用一下, 避免 unused 警告
      void scrollTop
      setActiveChapter((prev) => (prev === active ? prev : active))
    })
  })

  // G1 · usePageRefresh 管 useLoad + useDidShow (自动跳首次 show, 避免双拉).
  //      从 task / ai-chat / task-detail navigateBack 回本页时自动刷新,
  //      让最新创建/取消的操作记录 + AI 分析能及时反映在时间线上.
  usePageRefresh(() => {
    // 预条件检查: 无 token 或 plotId 丢失则不拉 (token 失效 http 拦截器会负责跳登录)
    if (!useAuthStore.getState().token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    if (!plotId) {
      setErr('参数缺失: plotId')
      return
    }
    refreshAll()
  })

  usePullDownRefresh(() => {
    refreshAll().finally(() => Taro.stopPullDownRefresh())
  })

  async function refreshAll() {
    const seq = ++refreshSeqRef.current
    setLoading(true)
    setErr('')
    try {
      const [d, s, r, l, a, slist] = await Promise.all([
        getPlotDetail(plotId),
        getSensorSummary(plotId).catch(() => null),
        getFarmingRecords(plotId, 1, 5).catch(() => null),
        getOperationLogs(plotId, 1, 5).catch(() => null),
        getLatestAnalysis(plotId).catch(() => null),
        getSensorList(plotId).catch(() => [] as Sensor[]),
      ])
      // 代际守卫: 期间有更新的 refresh 就丢弃本次结果
      if (seq !== refreshSeqRef.current) return
      setDetail(d)
      setSensors(s)
      setSensorList(slist || [])
      setRecords(r?.list || [])
      setLogs(l?.list || [])
      // FIX · handleAnalyzeAgain 在跑时 (触发 LLM 可能 10s+), 这里 getLatestAnalysis
      //   可能返回触发前的旧快照. 若先于触发完成落 state, 会把新结果覆盖成旧的.
      //   analyzingRef.current=true 时不更新 analysis, 让 handleAnalyzeAgain 负责.
      if (!analyzingRef.current) setAnalysis(a)
    } catch (e) {
      if (seq !== refreshSeqRef.current) return
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (seq === refreshSeqRef.current) setLoading(false)
    }
  }

  async function handleAnalyzeAgain() {
    if (analyzingRef.current) return
    analyzingRef.current = true
    setAnalyzing(true)
    try {
      const a = await triggerAnalysis(plotId)
      setAnalysis(a)
      Taro.showToast({ title: 'AI 分析完成', icon: 'success', duration: 900 })
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '分析失败',
        icon: 'none',
      })
    } finally {
      setAnalyzing(false)
      analyzingRef.current = false
    }
  }

  const cropBatch = detail?.currentCropBatch
  const title = detail?.plotName || plotNameFromQuery

  function openAiChat() {
    const name = encodeURIComponent(title)
    Taro.navigateTo({
      url: `/pages/ai-chat/index?plotId=${plotId}&plotName=${name}`,
    })
  }

  function openTaskPage() {
    const name = encodeURIComponent(title)
    Taro.navigateTo({
      url: `/pages/task/index?plotId=${plotId}&plotName=${name}`,
    })
  }

  function openShareCodes() {
    const name = encodeURIComponent(title)
    Taro.navigateTo({
      url: `/pages/share-codes/index?plotId=${plotId}&plotName=${name}`,
    })
  }

  return (
    <View className='plot-page'>
      {/* --- 页头 --- */}
      <View className='plot-head'>
        <Text className='plot-head__seal'>§ 02 · 地块详情</Text>
        <Text className='plot-head__title'>{title}</Text>
        {detail ? (
          <Text className='plot-head__lede'>
            — {fmtArea(detail.areaSize, detail.areaUnit)}
            {detail.farmName ? ` · ${detail.farmName}` : ''}
            {detail.plotNo ? ` · ${detail.plotNo}` : ''}
          </Text>
        ) : null}
        {pentadInfo ? (
          <Text className='plot-head__pentad'>
            〈 {pentadInfo.term.name} · 第 {pentadInfo.index} 候 〉— {pentadInfo.name}
          </Text>
        ) : null}
      </View>

      {/* --- 章节目录 · 纯装饰 hairline nav --- */}
      <ChapterIndex
        items={[
          { seal: '§ 01', label: '批次' },
          { seal: '§ 02', label: '当前' },
          { seal: '§ 03', label: '历史' },
          { seal: '§ 04', label: '农事' },
          { seal: '§ 05', label: '操作' },
        ]}
        activeIndex={activeChapter}
        onJump={(idx) => {
          setActiveChapter(idx)
          scrollToChapter(idx)
        }}
      />

      {err ? <Text className='plot-page__err'>! {err}</Text> : null}

      {/* --- §00 AI 分析结论 (如果有) --- */}
      <View className='plot-section'>
        <View className='plot-section__title-row'>
          <Text className='plot-section__title'>§ 00 · AI 分析</Text>
          <Text
            className={`plot-section__action ${analyzing ? 'plot-section__action--dim' : ''}`}
            onClick={handleAnalyzeAgain}
          >
            {analyzing ? '分析中 …' : '重新分析 ↻'}
          </Text>
        </View>

        {analysis ? (
          <View className={`ai-card ai-card--${analysis.riskLevel}`}>
            <View className='ai-card__head'>
              <Text className='ai-card__tag'>
                {analysis.analysisType === 'periodic' ? '定时' : '手动'}
              </Text>
              <Text className={`folio-tag folio-tag--${riskTone(analysis.riskLevel)}`}>
                {String(analysis.riskLevel).toUpperCase()}
              </Text>
              <Text className='ai-card__time'>
                {analysis.createdAt ? analysis.createdAt.slice(5, 16) : ''}
              </Text>
            </View>
            <Text className='ai-card__result'>{analysis.analysisResult}</Text>
            {analysis.suggestedActions && analysis.suggestedActions.length > 0 ? (
              <View className='ai-card__actions'>
                {analysis.suggestedActions.map((a, i) => (
                  <Text key={i} className='ai-card__action'>· {a}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <Text className='plot-empty'>
            — 暂无 AI 分析 · 点右上「重新分析」触发 —
          </Text>
        )}
      </View>

      {/* --- §01 作物批次 --- */}
      {cropBatch ? (
        <View className='plot-section' id='chapter-1'>
          <Text className='plot-section__title'>§ 01 · 作物批次</Text>
          <PageQuote text='种瓜得瓜, 种豆得豆' source='农政全书 · 卷一' />
          {/* 生长阶段进度条 · 视觉锚点 (播种→出苗→生长→开花→成熟) */}
          <GrowthStageBar stage={cropBatch.growthStage} />
          <MetaRow k='作物' v={cropBatch.cropName || '—'} />
          {cropBatch.varietyName ? (
            <MetaRow k='品种' v={cropBatch.varietyName} />
          ) : null}
          {cropBatch.sowingAt ? (
            <MetaRow k='播种' v={cropBatch.sowingAt.slice(0, 10)} mono />
          ) : null}
          {cropBatch.expectedHarvestAt ? (
            <MetaRow k='预计收获' v={cropBatch.expectedHarvestAt.slice(0, 10)} mono />
          ) : null}
          <MetaRow k='批次号' v={cropBatch.batchNo} mono />
          <SectionFin seal='§ 01' meta={cropBatch.cropName || ''} time={cropBatch.sowingAt?.slice(5, 10)} />
        </View>
      ) : !loading && detail ? (
        <View className='plot-section' id='chapter-1'>
          <Text className='plot-section__title'>§ 01 · 作物批次</Text>
          <Text className='plot-empty'>— 暂无活跃作物批次 —</Text>
        </View>
      ) : null}

      {/* --- §02 传感器 · 当前值 --- */}
      <View className='plot-section' id='chapter-2'>
        <Text className='plot-section__title'>§ 02 · 传感数据 · 当前</Text>
        <PageQuote text='看一块地的脾气, 先看它今天出了什么汗' />
        {sensors && sensors.summary && sensors.summary.length > 0 ? (
          <View className='sensor-grid'>
            {(() => {
              // sensorType → sensorId 映射 (从 /plots/{id}/sensors 拉来), 供 mini sparkline 拿 history 用
              const idByType = new Map<string, number>()
              sensorList.forEach((s) => {
                if (s.sensorType && s.sensorId != null) idByType.set(s.sensorType, s.sensorId)
              })
              return sensors.summary.map((s) => {
              // 阈值检测: 已知传感器类型 → 渲染色带 · 未知类型 → 仅数字
              const threshold = resolveThreshold(s.sensorType)
              const num = typeof s.value === 'number' ? s.value : Number(s.value)
              const hasNum = Number.isFinite(num)
              const alert = threshold && hasNum ? !isValueSafe(num, threshold) : false
              const cursorLeft = threshold && hasNum ? thresholdCursorPercent(num, threshold) : 50
              return (
                <View
                  key={s.sensorType}
                  className={`sensor-cell ${alert ? 'sensor-cell--alert' : ''}`}
                >
                  <View className='sensor-cell__top'>
                    <Text className='sensor-cell__label'>
                      {s.label || sensorLabel(s.sensorType)}
                    </Text>
                    <SensorCellSpark
                      sensorId={idByType.get(s.sensorType) ?? null}
                      sensorType={s.sensorType}
                      alert={alert}
                    />
                  </View>
                  <View className='sensor-cell__value'>
                    {hasNum ? (
                      <DigitFlipper
                        value={Number(s.value)}
                        unit={s.unit && s.unit !== '-' ? s.unit : undefined}
                        alert={!!alert}
                      />
                    ) : (
                      <Text className='sensor-cell__num'>—</Text>
                    )}
                  </View>
                  {threshold && hasNum ? (
                    <View className='sensor-cell__threshold'>
                      <View className='sensor-cell__threshold-band'>
                        <View
                          className='sensor-cell__threshold-cursor'
                          style={{ left: `${cursorLeft}%` }}
                        />
                      </View>
                      <View className='sensor-cell__threshold-range'>
                        <Text className='sensor-cell__threshold-tick'>{threshold.displayMin}</Text>
                        <Text className='sensor-cell__threshold-tick'>{threshold.displayMax}</Text>
                      </View>
                    </View>
                  ) : null}
                  <Text className='sensor-cell__time'>
                    {s.sampleAt ? s.sampleAt.slice(5, 16) : '—'}
                  </Text>
                </View>
              )
            })
            })()}
          </View>
        ) : (
          <Text className='plot-empty'>— 暂无传感器数据 —</Text>
        )}
        {sensors && sensors.summary && sensors.summary.length > 0 ? (
          <SectionFin
            seal='§ 02'
            meta={`${sensors.summary.length} readings`}
            time={sensors.summary[0]?.sampleAt?.slice(5, 16)}
          />
        ) : null}
      </View>

      {/* --- §03 传感器 · 历史曲线 --- */}
      {plotId ? (
        <View className='plot-section' id='chapter-3'>
          <Text className='plot-section__title'>§ 03 · 传感数据 · 历史</Text>
          <PageQuote text='观今宜鉴古, 无古不成今' source='增广贤文' />
          <SensorChart plotId={plotId} sensors={sensors} />
          <SectionFin seal='§ 03' meta='24h · 7d · 30d' />
        </View>
      ) : null}

      {/* --- §04 最近农事 --- */}
      <View className='plot-section' id='chapter-4'>
        <Text className='plot-section__title'>§ 04 · 农事记录</Text>
        <PageQuote text='春种一粒粟, 秋收万颗子' source='悯农 · 李绅' />
        {records.length > 0 ? (
          <View className='timeline'>
            {records.map((r) => (
              <View key={r.recordId} className='timeline-row'>
                <View className='timeline-row__head'>
                  <Text className='timeline-row__title'>{r.recordTitle}</Text>
                  <Text className={`folio-tag folio-tag--${recordTone(r.recordType)}`}>
                    {recordTypeLabel(r.recordType)}
                  </Text>
                </View>
                <Text className='timeline-row__meta'>
                  {r.recordTime ? r.recordTime.slice(0, 16) : '—'}
                  {r.operatorName ? ` · ${r.operatorName}` : ''}
                </Text>
                {r.description ? (
                  <Text className='timeline-row__desc'>{r.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text className='plot-empty'>— 暂无农事记录 —</Text>
        )}
        {records.length > 0 ? (
          <SectionFin seal='§ 04' meta={`${records.length} entries`} />
        ) : null}
      </View>

      {/* --- §05 最近操作 --- */}
      <View className='plot-section' id='chapter-5'>
        <Text className='plot-section__title'>§ 05 · 操作记录</Text>
        <PageQuote text='浇地 · 施肥 · 喷淋, 一笔一画都留底' />
        {logs.length > 0 ? (
          <View className='timeline'>
            {logs.map((t) => {
              const si = TASK_STATUS_LABEL[t.taskStatus] || {
                text: t.taskStatus,
                tone: 'ink-faint',
              }
              return (
                <View
                  key={t.taskId}
                  className='timeline-row'
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/task-detail/index?taskId=${t.taskId}`,
                    })
                  }
                >
                  <View className='timeline-row__head'>
                    <Text className='timeline-row__title'>{t.actionName}</Text>
                    <Text className={`folio-tag folio-tag--${si.tone}`}>
                      {si.text}
                    </Text>
                  </View>
                  <Text className='timeline-row__meta'>
                    {t.createdAt ? t.createdAt.slice(0, 16) : '—'} · T-…{t.taskNo.slice(-6)}
                  </Text>
                </View>
              )
            })}
          </View>
        ) : (
          <Text className='plot-empty'>— 暂无操作记录 —</Text>
        )}
        {logs.length > 0 ? (
          <SectionFin seal='§ 05' meta={`${logs.length} tasks`} time={logs[0]?.createdAt?.slice(5, 16)} />
        ) : null}
      </View>

      {/* --- 底部 CTA · 主 "申请操作" + 侧 "问 AI" / "分享码" · guest 只剩问 AI --- */}
      {isGuest ? (
        <View className='plot-ctas plot-ctas--guest'>
          <Text className='plot-ctas__guest-note'>
            § GUEST · 仅浏览. 操作权限不开放给分享访问者.
          </Text>
          <Button className='plot-cta plot-cta--ghost' onClick={openAiChat}>
            <Text className='plot-cta__text'>问 AI</Text>
            <Text className='plot-cta__arrow'>→</Text>
          </Button>
        </View>
      ) : (
        <View className='plot-ctas'>
          <Button className='plot-cta plot-cta--ghost' onClick={openAiChat}>
            <View className='plot-cta__label'>
              <Text className='plot-cta__seal'>§ AI</Text>
              <Text className='plot-cta__text'>问 AI</Text>
            </View>
            <Text className='plot-cta__arrow'>→</Text>
          </Button>
          <Button className='plot-cta plot-cta--primary' onClick={openTaskPage}>
            <View className='plot-cta__label'>
              <Text className='plot-cta__seal plot-cta__seal--light'>§ ACT</Text>
              <Text className='plot-cta__text'>申请操作</Text>
            </View>
            <Text className='plot-cta__arrow plot-cta__arrow--light'>→</Text>
          </Button>
          <Button className='plot-cta plot-cta--ghost' onClick={openShareCodes}>
            <View className='plot-cta__label'>
              <Text className='plot-cta__seal'>§ SHR</Text>
              <Text className='plot-cta__text'>分享码</Text>
            </View>
            <Text className='plot-cta__arrow'>→</Text>
          </Button>
        </View>
      )}
    </View>
  )
}

// ---- 小组件: meta 行 ----
function MetaRow({
  k,
  v,
  mono,
  tone,
}: {
  k: string
  v: string
  mono?: boolean
  tone?: 'sage' | 'fog' | 'sand' | 'clay'
}) {
  return (
    <View className='meta-row'>
      <Text className='meta-row__key'>{k}</Text>
      <Text
        className={`meta-row__val ${mono ? 'meta-row__val--mono' : ''} ${
          tone ? `meta-row__val--${tone}` : ''
        }`}
      >
        {v}
      </Text>
    </View>
  )
}

// ---- 传感器中文标签 ----
function sensorLabel(type: string): string {
  const MAP: Record<string, string> = {
    temperature: '气温',
    humidity: '空气湿度',
    light: '光照',
    co2: 'CO₂',
    soil_temperature: '土壤温度',
    soil_moisture: '土壤湿度',
    soil_ph: '土壤 pH',
    ph: '土壤 pH',
    nitrogen: '氮',
    phosphorus: '磷',
    potassium: '钾',
  }
  return MAP[type] || type
}

// ---- 农事类型 → 中文 + tone ----
function recordTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    sowing: '播种',
    irrigation: '灌溉',
    fertilization: '施肥',
    pruning: '修剪',
    pest_control: '防治',
    harvest: '收获',
    inspection: '巡查',
    note: '备注',
  }
  return MAP[type] || type
}

function recordTone(type: string): string {
  const MAP: Record<string, string> = {
    sowing: 'sage',
    irrigation: 'fog',
    fertilization: 'sand',
    pruning: 'plum',
    pest_control: 'clay',
    harvest: 'moss',
    inspection: 'muted',
    note: 'muted',
  }
  return MAP[type] || 'muted'
}

function fmtArea(size: number | string | null | undefined, unit: string): string {
  // N83 · PlotDetail.areaSize 类型是 number | string, 但契约外 (旧数据/空地块) 可能
  //       回 null/undefined; 不防御会渲染成 "null 亩" / "undefined 亩" 错位
  if (size == null) return `— ${unit}`
  const n = typeof size === 'string' ? Number(size) : size
  if (!Number.isFinite(n)) return `${size} ${unit}`
  const unitLabel: Record<string, string> = { mu: '亩', hectare: '公顷', m2: 'm²' }
  return `${n.toFixed(1)} ${unitLabel[unit] || unit}`
}

function riskTone(r: string): string {
  if (r === 'high') return 'clay'
  if (r === 'medium') return 'sand'
  return 'sage'
}
