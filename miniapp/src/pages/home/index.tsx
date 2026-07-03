import { View, Text, Swiper, SwiperItem, Image } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Heart, Message, Order, User } from '@nutui/icons-react-taro'
import { useMemo, useRef, useState } from 'react'
import { getMyAdoptions } from '@/api/adoption'
import { getMyOperationTasks } from '@/api/task'
import { getSensorSummary } from '@/api/plot'
import type { SensorSummary } from '@/types'
import { useAuthStore } from '@/store/auth'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import DigitFlipper from '@/components/DigitFlipper'
import Marquee from '@/components/Marquee'
import { getCurrentPentad } from '@/lib/solar-terms'
import recIrrigation from '@/assets/recs/irrigation.jpg'
import recStorm from '@/assets/recs/storm.jpg'
import recGrowth from '@/assets/recs/growth.jpg'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §00 · HOME · Compact Folio (小程序适配版)
 * ============================================================
 *  保留 Folio 风格 (衬线 + 印章 + hairline + 等宽 mono),
 *  但删除一切"网页杂志感"的浪费空间元素:
 *    × 100vh 巨型 hero
 *    × 视差滚动 / SCROLL ↓ 提示
 *    × 双 ticker (顶 + 底)
 *    × §FIN 收尾大印章
 *
 *  改用小程序合理布局:
 *    · ~180rpx 紧凑 hero (节气 + 用户在一行)
 *    · 顶部 1 条 ticker (实时元数据)
 *    · 关注三卡 + 此刻四读数 + 推荐三条 + 入口四卡 + 番外引文
 *    · 一屏内能看到 §00 hero / §01 关注 / §02 此刻 顶端
 *    · 关注/此刻接真实后端, 推荐/ticker 为编辑内容
 * ============================================================ */

// ---- 编辑内容 --------------------------------------------------

const FEATURE_RECS = [
  { no: '01', title: '芒种宜浇水',           desc: '土壤湿度 60% 以下 · 当日剩余 7/10', tag: 'IRRIG',   img: recIrrigation },
  { no: '02', title: '雷雨预警 · 6 级东南风',  desc: '建议巡查卷帘机 + 排水口 · 19:30 影响', tag: 'WEATHER', img: recStorm },
  { no: '03', title: '株高 +12cm / 周',      desc: '§02 大棚长势优于均值 8% · 进入开花期', tag: 'GROWTH',  img: recGrowth },
]

const TICKER = [
  'GMT+8',
  'LIVE 12 / 12 ONLINE',
  '今日上行 4321 帧',
  'MQTT QoS1',
  'BAT 96%',
  '§ FOLIO No.07',
]

// ---- 首页实时数据 -------------------------------------------------

interface HomeStats {
  adoptionCount: number
  todoCount: number
  alertCount: number
  plotName: string | null
  summary: SensorSummary['summary']
}

const EMPTY_STATS: HomeStats = {
  adoptionCount: 0,
  todoCount: 0,
  alertCount: 0,
  plotName: null,
  summary: [],
}

// 传感器类型 → 此刻展示的中文标签 (取前 4 个展示)
const SENSOR_LABEL: Record<string, string> = {
  temperature: '温度',
  humidity: '湿度',
  light: '光照',
  co2: 'CO₂',
  soil_moisture: '壤情',
  soil_temperature: '地温',
}

// ---- 页面 -------------------------------------------------------

export default function HomePage() {
  const userInfo = useAuthStore((s) => s.userInfo)
  const roleType = userInfo?.roleType || 'adopter'
  const greetName = userInfo?.nickname || '游客'

  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS)
  const fetchedAtRef = useRef(0)

  async function refreshStats() {
    // 30s 内不重拉, 避免切 tab 颤拖接口
    if (Date.now() - fetchedAtRef.current < 30_000) return
    fetchedAtRef.current = Date.now()
    try {
      const [adoptions, tasks] = await Promise.all([
        getMyAdoptions({ status: 'active', pageSize: 50 }),
        getMyOperationTasks({ pageSize: 50 }),
      ])
      const list = adoptions?.list ?? []
      const taskList = tasks?.list ?? []
      const todoCount = taskList.filter((t) =>
        ['pending', 'queued', 'running'].includes(t.taskStatus),
      ).length
      const alertCount = taskList.filter((t) => t.taskStatus === 'failed').length

      let plotName: string | null = null
      let summary: SensorSummary['summary'] = []
      const firstPlotId = list[0]?.plotId
      if (firstPlotId) {
        plotName = list[0]?.plotName ?? null
        try {
          const s = await getSensorSummary(firstPlotId)
          summary = s?.summary ?? []
        } catch (e) {
          console.warn('[HomePage] sensor summary failed', e)
        }
      }
      setStats({
        adoptionCount: adoptions?.total ?? list.length,
        todoCount,
        alertCount,
        plotName,
        summary,
      })
    } catch (e) {
      console.warn('[HomePage] refresh stats failed', e)
      fetchedAtRef.current = 0
    }
  }

  const pentadInfo = useMemo(() => {
    try { return getCurrentPentad() } catch { return null }
  }, [])

  const stamp = useMemo(() => {
    const d = new Date()
    const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
    return {
      date: `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}`,
    }
  }, [])

  useLoad(() => { /* tabBar 自己同步 */ })
  useDidShow(() => {
    Taro.eventCenter.trigger(TAB_BAR_SYNC_EVT, '/pages/home/index')
    void refreshStats()
  })

  function go(path: string, isTab = true) {
    if (isTab) {
      Taro.switchTab({ url: path }).catch(() => Taro.redirectTo({ url: path }))
    } else {
      Taro.navigateTo({ url: path })
    }
  }

  return (
    <View className='home-page'>
      <BrandNavBar />
      {/* ===== HERO · 紧凑印章条 (~180rpx) ===== */}
      <View className='hero'>
        <View className='hero__row'>
          <Text className='hero__seal'>§ 00 · TODAY</Text>
          <Text className='hero__stamp'>{stamp.date} {stamp.time}</Text>
        </View>
        <View className='hero__main'>
          <View className='hero__main-left'>
            <Text className='hero__term'>
              {pentadInfo ? `${pentadInfo.term.name} · 第 ${pentadInfo.index} 候` : '今日'}
            </Text>
            <Text className='hero__pentad'>{pentadInfo?.name || '—'}</Text>
          </View>
          <View className='hero__main-right'>
            <Text className='hero__greet'>你好, {greetName}</Text>
            <Text className='hero__role'>FOLIO No.07 / {roleLabelEn(roleType)}</Text>
          </View>
        </View>
      </View>

      {/* ===== Ticker · 1 条工业元数据 ===== */}
      <View className='ticker'>
        <Marquee items={TICKER} speed={42} />
      </View>

      {/* ===== §01 · 我的关注 · 3 数字卡 ===== */}
      <View className='section'>
        <View className='section__head'>
          <Text className='section__seal'>§ 01</Text>
          <Text className='section__title'>关注</Text>
          <Text className='section__title-en'>FOCUS</Text>
        </View>
        <View className='focus-grid'>
          <View className='focus-cell' onClick={() => go('/pages/adoptions/index')}>
            <View className='focus-cell__num'>
              <DigitFlipper value={String(stats.adoptionCount)} unit='块' size='hero' />
            </View>
            <Text className='focus-cell__label'>认养地块</Text>
            <View className='focus-cell__rule' />
          </View>
          <View className='focus-cell' onClick={() => go('/pages/task/index', false)}>
            <View className='focus-cell__num'>
              <DigitFlipper value={String(stats.todoCount)} unit='件' size='hero' />
            </View>
            <Text className='focus-cell__label'>进行中任务</Text>
            <View className='focus-cell__rule' />
          </View>
          <View className='focus-cell' onClick={() => go('/pages/task/index', false)}>
            <View className={`focus-cell__num ${stats.alertCount > 0 ? 'focus-cell__num--alert' : ''}`}>
              <DigitFlipper value={String(stats.alertCount)} unit='项' size='hero' alert={stats.alertCount > 0} />
            </View>
            <Text className={`focus-cell__label ${stats.alertCount > 0 ? 'focus-cell__label--alert' : ''}`}>异常任务</Text>
            <View className={`focus-cell__rule ${stats.alertCount > 0 ? 'focus-cell__rule--alert' : ''}`} />
          </View>
        </View>
      </View>

      {/* ===== §02 · 此刻 · 4 mini cells ===== */}
      <View className='section'>
        <View className='section__head'>
          <Text className='section__seal'>§ 02</Text>
          <Text className='section__title'>此刻</Text>
          <Text className='section__title-en'>NOW</Text>
          <View className='rec'>
            <View className='rec__dot' />
            <Text className='rec__text'>REC</Text>
          </View>
        </View>
        {stats.summary.length > 0 ? (
          <>
            <Text className='now-plot'>{stats.plotName || '我的地块'}</Text>
            <View className='now-grid'>
              {stats.summary.slice(0, 4).map((s) => (
                <NowCell
                  key={s.sensorType}
                  label={s.label || SENSOR_LABEL[s.sensorType] || s.sensorType}
                  value={s.value != null ? String(s.value) : '—'}
                  unit={s.unit || ''}
                  trend='flat'
                />
              ))}
            </View>
            <View className='now-cta' onClick={() => go('/pages/adoptions/index')}>
              <Text className='now-cta__text'>进入地块详情</Text>
              <Text className='now-cta__arrow'>→</Text>
            </View>
          </>
        ) : (
          <View className='now-cta' onClick={() => go('/pages/adoptions/index')}>
            <Text className='now-cta__text'>还没有认养地块 · 去看看</Text>
            <Text className='now-cta__arrow'>→</Text>
          </View>
        )}
      </View>

      {/* ===== §03 · 今日推荐 · Editorial 序号 ===== */}
      <View className='section'>
        <View className='section__head'>
          <Text className='section__seal'>§ 03</Text>
          <Text className='section__title'>推荐</Text>
          <Text className='section__title-en'>FEATURED</Text>
        </View>
        <Swiper
          className='rec-swiper'
          circular
          autoplay
          interval={4000}
          indicatorDots
          indicatorColor='rgba(255, 255, 255, 0.4)'
          indicatorActiveColor='#ffffff'
        >
          {FEATURE_RECS.map((r) => (
            <SwiperItem key={r.no}>
              <View className='rec-slide'>
                <Image className='rec-slide__img' src={r.img} mode='aspectFill' />
                <View className='rec-slide__mask' />
                <View className='rec-slide__body'>
                  <Text className='rec-slide__tag'>{r.tag}</Text>
                  <Text className='rec-slide__title'>{r.title}</Text>
                  <Text className='rec-slide__desc'>{r.desc}</Text>
                </View>
              </View>
            </SwiperItem>
          ))}
        </Swiper>
      </View>

      {/* ===== §04 · 入口 · 角色感知 ===== */}
      <View className='section'>
        <View className='section__head'>
          <Text className='section__seal'>§ 04</Text>
          <Text className='section__title'>入口</Text>
          <Text className='section__title-en'>ENTRIES</Text>
        </View>
        <View className='entries'>
          {(roleType === 'operator' || roleType === 'agronomist') && (
            <View className='entry' onClick={() => go('/pages/operator-workbench/index')}>
              <View className='entry__circle'><Order size={26} /></View>
              <Text className='entry__label'>工作台</Text>
            </View>
          )}
          <View className='entry' onClick={() => go('/pages/adoptions/index')}>
            <View className='entry__circle'><Heart size={26} /></View>
            <Text className='entry__label'>我的认养</Text>
          </View>
          <View className='entry' onClick={() => go('/pages/ai-assist/index')}>
            <View className='entry__circle'><Message size={26} /></View>
            <Text className='entry__label'>AI 农技</Text>
          </View>
          <View className='entry' onClick={() => go('/pages/me/index')}>
            <View className='entry__circle'><User size={26} /></View>
            <Text className='entry__label'>个人中心</Text>
          </View>
        </View>
      </View>

      {/* ===== §05 · 番外 · 一句引文 ===== */}
      <View className='section section--coda'>
        <View className='coda'>
          <Text className='coda__quote'>种瓜得瓜, 种豆得豆</Text>
          <Text className='coda__source'>— 农政全书 · 卷一</Text>
        </View>
        <Text className='coda__set'>
          FOLIO No.07 / 韶山稻梦田园
        </Text>
      </View>
    </View>
  )
}

// ---- §02 NOW 单元格 ---------------------

function NowCell({ label, value, unit, trend }: {
  label: string; value: string; unit: string; trend: 'up' | 'flat' | 'down'
}) {
  const trendArrow = trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'
  return (
    <View className='now-cell'>
      <View className='now-cell__head'>
        <Text className='now-cell__label'>{label}</Text>
        <Text className={`now-cell__trend now-cell__trend--${trend}`}>{trendArrow}</Text>
      </View>
      <View className='now-cell__num-row'>
        <Text className='now-cell__num'>{value}</Text>
        <Text className='now-cell__unit'>{unit}</Text>
      </View>
    </View>
  )
}

// ---- 辅助 ----

function roleLabelEn(role: string): string {
  const MAP: Record<string, string> = {
    adopter: 'ADOPTER', operator: 'OPERATOR', agronomist: 'AGRONOMIST',
    admin: 'ADMIN', guest: 'GUEST',
  }
  return MAP[role] || 'GUEST'
}
