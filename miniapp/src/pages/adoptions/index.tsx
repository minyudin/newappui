import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { getCurrentUser } from '@/api/auth'
import { getMyAccessScope, getMyAdoptions } from '@/api/adoption'
import { useAuthStore } from '@/store/auth'
import type { AdoptionListItem, OrderStatus } from '@/types'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import { useRequireRole } from '@/hooks/useRequireRole'
import { usePageRefresh } from '@/hooks/usePageRefresh'
import { cropGlyph } from '@/lib/crop-glyph'
import PlotMicroBar from '@/components/PlotMicroBar'
import DigitFlipper from '@/components/DigitFlipper'
import './index.scss'

/**
 * §1 · 我的认养 (首页 · 登录后着陆页)
 * ============================================================
 *  - useLoad: 并行拉 userInfo + /my/adoptions
 *  - 下拉刷新: 两者都重拉
 *  - 列表渲染地块卡 (封面 / 作物 / 有效期 / 状态标签)
 *  - 空态: 引导去兑换
 * ============================================================ */

const ORDER_STATUS_LABEL: Record<OrderStatus | string, { text: string; tone: string }> = {
  active: { text: '生效中', tone: 'sage' },
  pending: { text: '待生效', tone: 'sand' },
  expired: { text: '已过期', tone: 'ink-faint' },
  cancelled: { text: '已取消', tone: 'ink-faint' },
  paid: { text: '已支付', tone: 'fog' },
}

// 模块级缓存: 同 app 生命周期内, 切换 tab 回到本页时直接用,
// 不再走 loading 闪一下再显示数据
//  · 必须按 userId 隔离, 否则 "用户 A 登出 → 用户 B 登入" 瞬间会看到 A 的列表
//     (模块级变量不会随 logout 重置). 也是 "退出再登录地块消失" bug 的
//     第二道防线 · 根因见 pages/login/index.tsx 注释.
let cachedList: AdoptionListItem[] = []
let cachedAt = 0
let cachedUserId: number | null = null
const STALE_MS = 30_000 // 30 秒内视为新鲜, 不 refetch

/** 判缓存对当前 userId 是否有效 */
function isCacheValidFor(userId: number | null | undefined): boolean {
  if (!userId) return false
  return cachedUserId === userId && cachedList.length > 0 && Date.now() - cachedAt < STALE_MS
}

/** 列表项日期在契约外可能缺省，避免 .slice 抛错导致整页白屏 */
function fmtAdoptionPeriod(item: AdoptionListItem): string {
  const a = (item.startAt ?? '').slice(0, 10) || '—'
  const b = (item.endAt ?? '').slice(0, 10) || '—'
  return `${a} → ${b}`
}

export default function AdoptionsPage() {
  // G2 · adopter 专属: 无 token → 登录页; operator → 工作台; guest → 我的
  //      hook 同时在 useLoad + useDidShow 直接守卫, A 登出/B 登入后切回本 tab 也能兑提
  useRequireRole('adopter')
  const userInfo = useAuthStore((s) => s.userInfo)
  const setUserInfo = useAuthStore((s) => s.setUserInfo)

  // 初值从模块缓存拿 · 仅当缓存属于当前 userId 才用
  // (防 A 登出 / B 登入瞬间渲染到 A 的数据)
  const [list, setList] = useState<AdoptionListItem[]>(() => {
    const uid = useAuthStore.getState().userInfo?.userId
    return isCacheValidFor(uid) ? cachedList : []
  })
  const [loading, setLoading] = useState(false)
  const [fetchErr, setFetchErr] = useState('')

  // N4 · refresh 代际守卫: 并发下拉/useDidShow/useLoad 时只让最后一次落 state
  const refreshSeqRef = useRef(0)
  const openingPlotIdRef = useRef<number | null>(null)

  // G1 · 统一用 usePageRefresh 管 useLoad + useDidShow (自动跳过首次 show, 避免双拉)
  //      首次 mount: cache 空 → refreshAll
  //      后续 show: cache 新鲜则跳过, 身份切换时先清空 UI 再 refresh
  usePageRefresh(() => {
    // tab 切回来时同步下 tabBar 选中态 (首次 mount 触发会重置为当前页, 无害)
    Taro.eventCenter.trigger(TAB_BAR_SYNC_EVT, '/pages/adoptions/index')
    // N3 · 用户 A 登出 → B 登入 → switchTab 回本页时, list state 还留着 A 的数据.
    //       检测 userId 不符立即清空, 避免 refresh 完成前屏幕显 A 的列表.
    const uid = useAuthStore.getState().userInfo?.userId
    if (cachedUserId != null && uid != null && cachedUserId !== uid) {
      setList([])
      cachedList = []
      cachedUserId = null
      cachedAt = 0
    }
    // 缓存新鲜 → 跳过网请求 (首次 mount cache 空, 此判断自然 false → 正常拉)
    if (isCacheValidFor(uid)) return
    refreshAll()
  })

  usePullDownRefresh(() => {
    refreshAll().finally(() => Taro.stopPullDownRefresh())
  })

  async function refreshAll() {
    const seq = ++refreshSeqRef.current
    // N5 · 判断缓存是否对当前用户有效, 无效才显 loading;
    //     先前只看 cachedList.length 会让从 A 切 B 的用户在等待期间看不到 loading.
    //  FIX · 用 getState 取 userId, 避免 tab 切回时闭包里的 userInfo 仍是旧帧导致误判缓存/请求参数
    const uidForCache = useAuthStore.getState().userInfo?.userId
    if (!isCacheValidFor(uidForCache)) setLoading(true)
    setFetchErr('')
    try {
      const cachedInfo = useAuthStore.getState().userInfo
      const [me, page] = await Promise.all([
        cachedInfo ? Promise.resolve(cachedInfo) : getCurrentUser(),
        getMyAdoptions({ pageNo: 1, pageSize: 50 }),
      ])
      // N4 · 如果期间有新的 refresh, 丢弃本次结果
      if (seq !== refreshSeqRef.current) return
      setUserInfo(me)
      const next = page.list || []
      setList(next)
      cachedList = next
      cachedAt = Date.now()
      cachedUserId = me?.userId ?? null
    } catch (e) {
      if (seq !== refreshSeqRef.current) return
      setFetchErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (seq === refreshSeqRef.current) setLoading(false)
    }
  }

  async function handleOpenPlot(item: AdoptionListItem) {
    if (openingPlotIdRef.current === item.plotId) return
    openingPlotIdRef.current = item.plotId
    console.log('[Adoptions] handleOpenPlot · plotId=', item.plotId, 'orderId=', item.orderId)
    try {
      // 入口前置校验：时间窗/权限未通过时，不跳详情页，避免“进页再报错”的割裂体验
      await getMyAccessScope(item.plotId)
      const plotName = encodeURIComponent(item.plotName || `地块#${item.plotId}`)
      await Taro.navigateTo({
        url: `/pages/plot/index?plotId=${item.plotId}&plotName=${plotName}`,
      })
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '当前不可访问该地块',
        icon: 'none',
      })
    } finally {
      openingPlotIdRef.current = null
    }
  }

  function handleRedeemTap() {
    console.log('[Adoptions] redeem button tapped')
    Taro.navigateTo({ url: '/pages/redeem/index' })
  }

  return (
    <View className='adoptions-page'>
      {/* --- 页头 · Folio 封面 + 右上 meta (logout 已移到我的 tab) --- */}
      <View className='adoptions-head'>
        <View className='adoptions-head__left'>
          <Text className='adoptions-head__seal'>§ 01 · MY ADOPTIONS</Text>
          <Text className='adoptions-head__title'>我的认养</Text>
          <Text className='adoptions-head__lede'>
            — {userInfo?.nickname ? `${userInfo.nickname}, ` : ''}
            {list.length > 0 ? `名下 ${list.length} 块田` : '还没有认养的地块'}
          </Text>
        </View>
        <View className='adoptions-head__meta'>
          <View className='adoptions-head__meta-num'>
            <DigitFlipper value={list.length.toString().padStart(2, '0')} mono size='hero' />
          </View>
          <Text className='adoptions-head__meta-label'>地块</Text>
        </View>
      </View>

      {/* --- 错误 --- */}
      {fetchErr ? <Text className='adoptions-page__err'>! {fetchErr}</Text> : null}

      {/* --- 认养列表 / 空态 --- */}
      {list.length > 0 ? (
        <View className='adoption-list'>
          {list.map((item) => {
            const status = ORDER_STATUS_LABEL[item.orderStatus] || {
              text: item.orderStatus,
              tone: 'ink-faint',
            }
            return (
              <View
                key={item.orderId}
                className='plot-card'
                onClick={() => handleOpenPlot(item)}
              >
                {/* 左: 印章格 · 田字格底纹 + 作物核心字 (麦/稻/茄/瓜/...) */}
                <View className='plot-card__cover'>
                  {item.coverUrl ? (
                    <Image
                      className='plot-card__cover-img'
                      src={item.coverUrl}
                      mode='aspectFill'
                    />
                  ) : (
                    <View className='plot-card__cover-fallback'>
                      <Text className='plot-card__cover-char'>{cropGlyph(item.cropName)}</Text>
                      <Text className='plot-card__cover-id'>
                        {String(item.plotId).slice(-4)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 中: 信息 */}
                <View className='plot-card__info'>
                  <View className='plot-card__title-row'>
                    <Text className='plot-card__title'>
                      {item.plotName || `地块 #${item.plotId}`}
                    </Text>
                    <Text className='plot-card__crop'>
                      {item.cropName
                        ? [
                            item.cropName,
                            item.varietyName ? ` · ${item.varietyName}` : '',
                            item.growthStage ? `  ·  ${item.growthStage}` : '',
                          ].join('')
                        : '暂未关联作物批次'}
                    </Text>
                  </View>
                  <Text className='plot-card__period'>{fmtAdoptionPeriod(item)}</Text>
                  <PlotMicroBar plotId={item.plotId} />
                </View>

                {/* 右: 状态 tag */}
                <Text className={`plot-card__badge plot-card__badge--${status.tone}`}>
                  {status.text}
                </Text>
              </View>
            )
          })}
        </View>
      ) : !loading ? (
        <View className='empty-state'>
          <Text className='empty-state__title'>— 还没有认养地块 —</Text>
          <Text className='empty-state__hint'>
            兑换认养码 · 地块将自动出现在这里
          </Text>
        </View>
      ) : (
        <View className='loading-state'>
          <Text>Loading …</Text>
        </View>
      )}

      {/* --- 主操作 · 文字 + 箭头独立 Text, 避开 Text::after 的 miniapp 坑 --- */}
      <Button
        className='action-btn'
        onClick={handleRedeemTap}
      >
        <Text className='action-btn__text'>兑换认养码</Text>
        <Text className='action-btn__arrow'>→</Text>
      </Button>
    </View>
  )
}
