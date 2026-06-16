import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh, useUnload } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { createShareCode, getMyShareCodes, revokeShareCode } from '@/api/adoption'
import type { ShareCodeItem } from '@/types'
import './index.scss'

function parsePlotId(v: string | undefined): number {
  const n = Number(v || 0)
  return Number.isFinite(n) ? n : 0
}

export default function ShareCodesPage() {
  const [plotId, setPlotId] = useState(0)
  const [plotName, setPlotName] = useState('当前地块')
  const [validDays, setValidDays] = useState('7')
  const [list, setList] = useState<ShareCodeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const [successCode, setSuccessCode] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const creatingRef = useRef(false)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const title = useMemo(() => `${plotName} · #${plotId || '-'}`, [plotName, plotId])

  useLoad((opts) => {
    const pid = parsePlotId((opts as { plotId?: string }).plotId)
    const pName = decodeURIComponent((opts as { plotName?: string }).plotName || '当前地块')
    setPlotId(pid)
    setPlotName(pName)
    if (pid) void refresh(pid)
  })

  usePullDownRefresh(() => {
    if (!plotId) return Taro.stopPullDownRefresh()
    refresh(plotId).finally(() => Taro.stopPullDownRefresh())
  })

  useUnload(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
  })

  async function refresh(pid = plotId) {
    setLoading(true)
    setErr('')
    try {
      const rows = await getMyShareCodes(pid)
      setList(rows || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!plotId || creatingRef.current) return
    const vd = Number(validDays || '7')
    if (!Number.isFinite(vd) || vd <= 0) {
      Taro.showToast({ title: '有效天数需 > 0', icon: 'none' })
      return
    }
    creatingRef.current = true
    setCreating(true)
    setErr('')
    try {
      const created = await createShareCode({ plotId, validDays: vd })
      setSuccessCode(created.code)
      setShowSuccess(true)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false)
        successTimerRef.current = null
      }, 1400)
      Taro.showToast({ title: '分享码已生成', icon: 'success' })
      await refresh(plotId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '生成失败'
      setErr(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setCreating(false)
      creatingRef.current = false
    }
  }

  async function handleCopy(code: string) {
    try {
      await Taro.setClipboardData({ data: code })
      Taro.showToast({ title: '已复制', icon: 'success' })
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  async function handleRevoke(item: ShareCodeItem) {
    const confirm = await Taro.showModal({
      title: '撤销分享码?',
      content: `撤销后 guest 将无法继续访问\n${item.code}`,
      confirmText: '撤销',
      cancelText: '取消',
      confirmColor: '#c5826a',
    })
    if (!confirm.confirm) return
    try {
      await revokeShareCode(item.codeId)
      Taro.showToast({ title: '已撤销', icon: 'success' })
      await refresh(plotId)
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '撤销失败', icon: 'none' })
    }
  }

  return (
    <View className='share-page'>
      {showSuccess ? (
        <View className='share-success'>
          <View className='share-success__card'>
            <Text className='share-success__seal'>§ · 已生成</Text>
            <Text className='share-success__title'>分享码已生成</Text>
            <Text className='share-success__code'>{successCode}</Text>
          </View>
        </View>
      ) : null}

      <View className='share-head'>
        <Text className='share-head__seal'>§ · 分享码</Text>
        <Text className='share-head__title'>分享码管理</Text>
        <Text className='share-head__lede'>— {title}</Text>
        <View className='share-head__meta'>
          <Text className='share-head__meta-key'>有效</Text>
          <Text className='share-head__meta-val'>{list.filter((x) => x.status === 'active').length}</Text>
          <Text className='share-head__meta-dot'>·</Text>
          <Text className='share-head__meta-key'>共</Text>
          <Text className='share-head__meta-val'>{list.length}</Text>
        </View>
      </View>

      <View className='share-create'>
        <View className='share-create__head'>
          <Text className='share-create__seal'>§ · 新建</Text>
          <Text className='share-create__title'>新建分享码</Text>
        </View>
        <View className='share-create__row'>
          <Text className='share-create__label'>有效天数</Text>
          <Input
            className='share-create__input'
            type='number'
            value={validDays}
            onInput={(e: { detail: { value: string } }) => setValidDays(e.detail.value)}
          />
          <Button className='share-create__btn' loading={creating} disabled={creating || !plotId} onClick={handleCreate}>
            <Text>{creating ? '生成中…' : '生成分享码'}</Text>
          </Button>
        </View>
        <Text className='share-create__hint'>默认继承该地块 master 码权限与时间窗，再做子集约束。</Text>
      </View>

      {err ? <Text className='share-err'>! {err}</Text> : null}

      <View className='share-list'>
        <View className='share-list__head'>
          <Text className='share-list__title'>§ · 我的分享</Text>
          <Text className='share-list__sub'>按创建时间倒序 · 下拉可刷新</Text>
        </View>
        {list.length === 0 && !loading ? (
          <Text className='share-empty'>— 暂无分享码 —</Text>
        ) : null}
        {list.map((item) => (
          <View key={item.codeId} className={`share-card ${item.status !== 'active' ? 'share-card--revoked' : ''}`}>
            {item.status !== 'active' ? <View className='share-void'>CANCELLED</View> : null}
            <View className='share-card__top'>
              <Text className='share-card__code'>{item.code}</Text>
              <Text className={`share-card__status share-card__status--${item.status === 'active' ? 'active' : 'revoked'}`}>
                {item.status === 'active' ? '有效' : '已撤销'}
              </Text>
            </View>
            <View className='share-card__meta-grid'>
              <Text className='share-card__meta-k'>有效期</Text>
              <Text className='share-card__meta-v'>{item.validFrom.slice(0, 10)} → {item.validTo.slice(0, 10)}</Text>
              <Text className='share-card__meta-k'>创建</Text>
              <Text className='share-card__meta-v'>{item.createdAt?.slice(0, 16) || '—'}</Text>
            </View>
            <View className='share-card__actions'>
              <Text className='share-card__action' onClick={() => handleCopy(item.code)}>
                复制
              </Text>
              {item.status === 'active' ? (
                <Text className='share-card__action share-card__action--danger' onClick={() => handleRevoke(item)}>
                  撤销
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

