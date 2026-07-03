import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { Heart, Message, Order, User } from '@nutui/icons-react-taro'
import { useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import DigitFlipper from '@/components/DigitFlipper'
import Marquee from '@/components/Marquee'
import { getCurrentPentad } from '@/lib/solar-terms'
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
 *    · 数据全静态 mock, 不接后端
 * ============================================================ */

// ---- 静态 mock --------------------------------------------------

const FEATURE_RECS = [
  { no: '01', title: '芒种宜浇水',           desc: '土壤湿度 60% 以下 · 当日剩余 7/10', tag: 'IRRIG' },
  { no: '02', title: '雷雨预警 · 6 级东南风',  desc: '建议巡查卷帘机 + 排水口 · 19:30 影响', tag: 'WEATHER' },
  { no: '03', title: '株高 +12cm / 周',      desc: '§02 大棚长势优于均值 8% · 进入开花期', tag: 'GROWTH' },
]

const TICKER = [
  'GMT+8',
  'LIVE 12 / 12 ONLINE',
  '今日上行 4321 帧',
  'MQTT QoS1',
  'BAT 96%',
  '§ FOLIO No.07',
]

// ---- 页面 -------------------------------------------------------

export default function HomePage() {
  const userInfo = useAuthStore((s) => s.userInfo)
  const roleType = userInfo?.roleType || 'adopter'
  const greetName = userInfo?.nickname || '游客'

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
              <DigitFlipper value={2} unit='块' size='hero' />
            </View>
            <Text className='focus-cell__label'>认养地块</Text>
            <View className='focus-cell__rule' />
          </View>
          <View className='focus-cell' onClick={() => go('/pages/adoptions/index')}>
            <View className='focus-cell__num'>
              <DigitFlipper value={3} unit='件' size='hero' />
            </View>
            <Text className='focus-cell__label'>待办任务</Text>
            <View className='focus-cell__rule' />
          </View>
          <View className='focus-cell' onClick={() => go('/pages/adoptions/index')}>
            <View className='focus-cell__num focus-cell__num--alert'>
              <DigitFlipper value={1} unit='项' size='hero' alert />
            </View>
            <Text className='focus-cell__label focus-cell__label--alert'>告警</Text>
            <View className='focus-cell__rule focus-cell__rule--alert' />
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
        <Text className='now-plot'>PLOT 01 · 西区大棚</Text>
        <View className='now-grid'>
          <NowCell label='温度' value='24.2' unit='°' trend='up' />
          <NowCell label='湿度' value='65.1' unit='%' trend='flat' />
          <NowCell label='光照' value='12.4k' unit='lx' trend='down' />
          <NowCell label='CO₂'  value='410'  unit='ppm' trend='up' />
        </View>
        <View className='now-cta' onClick={() => go('/pages/adoptions/index')}>
          <Text className='now-cta__text'>进入地块详情</Text>
          <Text className='now-cta__arrow'>→</Text>
        </View>
      </View>

      {/* ===== §03 · 今日推荐 · Editorial 序号 ===== */}
      <View className='section'>
        <View className='section__head'>
          <Text className='section__seal'>§ 03</Text>
          <Text className='section__title'>推荐</Text>
          <Text className='section__title-en'>FEATURED</Text>
        </View>
        {FEATURE_RECS.map((r) => (
          <View key={r.no} className='rec-row'>
            <Text className='rec-row__no'>{r.no}</Text>
            <View className='rec-row__body'>
              <View className='rec-row__head'>
                <Text className='rec-row__title'>{r.title}</Text>
                <Text className='rec-row__tag'>{r.tag}</Text>
              </View>
              <Text className='rec-row__desc'>{r.desc}</Text>
            </View>
          </View>
        ))}
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
            <View
              className='entry entry--primary'
              onClick={() => go('/pages/operator-workbench/index')}
            >
              <View className='entry__seal'><Order size={24} /></View>
              <View className='entry__body'>
                <Text className='entry__title'>运营工作台</Text>
                <Text className='entry__sub'>待领 · 责任域 · 异常</Text>
              </View>
              <Text className='entry__arrow'>→</Text>
            </View>
          )}
          <View className='entry' onClick={() => go('/pages/adoptions/index')}>
            <View className='entry__seal'><Heart size={24} /></View>
            <View className='entry__body'>
              <Text className='entry__title'>我的认养</Text>
              <Text className='entry__sub'>地块 · 操作 · 农事</Text>
            </View>
            <Text className='entry__arrow'>→</Text>
          </View>
          <View className='entry' onClick={() => go('/pages/ai-assist/index')}>
            <View className='entry__seal'><Message size={24} /></View>
            <View className='entry__body'>
              <Text className='entry__title'>AI 农技</Text>
              <Text className='entry__sub'>问答 · 诊断 · 节气建议</Text>
            </View>
            <Text className='entry__arrow'>→</Text>
          </View>
          <View className='entry' onClick={() => go('/pages/me/index')}>
            <View className='entry__seal'><User size={24} /></View>
            <View className='entry__body'>
              <Text className='entry__title'>个人中心</Text>
              <Text className='entry__sub'>账号 · 设置 · 退出</Text>
            </View>
            <Text className='entry__arrow'>→</Text>
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
