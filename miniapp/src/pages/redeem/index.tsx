import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { verifyAdoptionCode, redeemAdoptionCode } from '@/api/adoption'
import { useAuthStore } from '@/store/auth'
import type { VerifyCodeResponse } from '@/types'
import './index.scss'

/**
 * §2 · 兑换认养码页
 * ============================================================
 *  三态:
 *    · idle      — 输入框 + 验证按钮
 *    · verified  — 显示码信息 + 权限预览 + 确认兑换
 *    · redeemed  — 成功 · 自动跳 /pages/adoptions
 * ============================================================ */

type Stage = 'idle' | 'verified' | 'redeemed'

export default function RedeemPage() {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [verifying, setVerifying] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState<VerifyCodeResponse | null>(null)

  // M4 · ref 瞬时锁, 比 state 早一帧生效
  const verifyingRef = useRef(false)
  const redeemingRef = useRef(false)
  // FIX · 兑换成功后 1500ms 再 switchTab. 若用户期间 navigateBack,
  //   计时器仍会 switchTab 导致导航错位. 用 ref 存 timer, useUnload 清理.
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLoad(() => {
    // 未登录打回去 (redeem 需要登录)
    if (!useAuthStore.getState().token) {
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  })

  useUnload(() => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }
  })

  async function handleVerify() {
    if (verifyingRef.current) return
    const trimmed = code.trim()
    if (!trimmed) {
      setErr('请输入认养码')
      return
    }
    verifyingRef.current = true
    setErr('')
    setVerifying(true)
    try {
      const res = await verifyAdoptionCode(trimmed)
      setInfo(res)
      setStage('verified')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '认养码校验失败')
    } finally {
      setVerifying(false)
      verifyingRef.current = false
    }
  }

  async function handleRedeem() {
    if (redeemingRef.current || !info) return
    redeemingRef.current = true
    // 成功路径继续锁住到 switchTab 生效 (1500ms), 防用户再点一次
    let keepLocked = false
    setErr('')
    setRedeeming(true)
    try {
      await redeemAdoptionCode(code.trim())
      setStage('redeemed')
      Taro.showToast({ title: '兑换成功', icon: 'success', duration: 1200 })
      keepLocked = true
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null
        // adoptions 是 tabBar 页 · 用 switchTab
        Taro.switchTab({ url: '/pages/adoptions/index' }).catch(() =>
          Taro.redirectTo({ url: '/pages/adoptions/index' }),
        )
      }, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '兑换失败')
      setStage('verified') // 保留在预览态让用户看错误
    } finally {
      setRedeeming(false)
      if (!keepLocked) redeemingRef.current = false
    }
  }

  function handleBackToEdit() {
    setStage('idle')
    setInfo(null)
    setErr('')
  }

  return (
    <View className='redeem-page'>
      <View className='redeem-head'>
        <Text className='redeem-head__seal'>§ 02 · 兑换认养码</Text>
        <Text className='redeem-head__title'>兑换认养码</Text>
        <Text className='redeem-head__lede'>
          {stage === 'idle' && '请输入卡片/订单上的认养码'}
          {stage === 'verified' && '确认以下地块 · 兑换后绑定到当前账号'}
          {stage === 'redeemed' && '已绑定到你的认养 · 即将跳转'}
        </Text>
      </View>

      {stage === 'idle' && (
        <View className='redeem-form'>
          <Text className='redeem-form__label'>认养码</Text>
          <Input
            className='redeem-form__input'
            value={code}
            onInput={(e: { detail: { value: string } }) => setCode(e.detail.value)}
            placeholder='例: LSGJ-8H2K-91AA'
            maxlength={64}
          />
          <Text className='redeem-form__hint'>
            · 认养码区分大小写
            {'\n'}· 每张卡片 / 订单独享
          </Text>

          {err ? <Text className='redeem-form__err'>{err}</Text> : null}

          <Button
            className='redeem-form__btn'
            loading={verifying}
            disabled={verifying || !code.trim()}
            onClick={handleVerify}
          >
            <Text className='redeem-form__btn-text'>
              {verifying ? '验证中' : '验证认养码'}
            </Text>
            <Text className='redeem-form__btn-arrow'>→</Text>
          </Button>
        </View>
      )}

      {stage === 'verified' && info && (
        <View className='redeem-preview'>
          <View className='preview-card'>
            <Text className='preview-card__label'>码类型</Text>
            <Text className='preview-card__val'>
              {info.codeType === 'master' && '主码 · 认养人专用'}
              {info.codeType === 'guest' && '客码 · 访客体验'}
              {info.codeType === 'share' && '分享码'}
              {!['master', 'guest', 'share'].includes(info.codeType) && info.codeType}
            </Text>
          </View>
          <View className='preview-card'>
            <Text className='preview-card__label'>地块</Text>
            <Text className='preview-card__val'>#{info.plotId}</Text>
          </View>
          <View className='preview-card'>
            <Text className='preview-card__label'>有效期</Text>
            <Text className='preview-card__val preview-card__val--mono'>
              {info.validFrom.slice(0, 10)} → {info.validTo.slice(0, 10)}
            </Text>
          </View>
          {info.dailyAccessStart && info.dailyAccessEnd ? (
            <View className='preview-card'>
              <Text className='preview-card__label'>每日访问时段</Text>
              <Text className='preview-card__val preview-card__val--mono'>
                {info.dailyAccessStart.slice(0, 5)} - {info.dailyAccessEnd.slice(0, 5)}
              </Text>
            </View>
          ) : null}

          <View className='perms-block'>
            <Text className='perms-block__title'>§ · 权限</Text>
            <View className='perms-row'>
              <Text className='perms-row__key'>实时视频</Text>
              <Text className={`perms-row__val ${info.permissions.canViewLive ? '' : 'perms-row__val--off'}`}>
                {info.permissions.canViewLive ? '允许' : '否'}
              </Text>
            </View>
            <View className='perms-row'>
              <Text className='perms-row__key'>历史回放</Text>
              <Text className={`perms-row__val ${info.permissions.canViewHistory ? '' : 'perms-row__val--off'}`}>
                {info.permissions.canViewHistory
                  ? `允许 · 近 ${info.permissions.historyDays ?? 0} 天`
                  : '否'}
              </Text>
            </View>
            <View className='perms-row'>
              <Text className='perms-row__key'>传感器数据</Text>
              <Text className={`perms-row__val ${info.permissions.canViewSensor ? '' : 'perms-row__val--off'}`}>
                {info.permissions.canViewSensor ? '允许' : '否'}
              </Text>
            </View>
            <View className='perms-row'>
              <Text className='perms-row__key'>远程操作</Text>
              <Text className={`perms-row__val ${info.permissions.canOperate ? '' : 'perms-row__val--off'}`}>
                {info.permissions.canOperate
                  ? `允许 · 日限 ${info.permissions.maxDailyOperations ?? '∞'}`
                  : '否'}
              </Text>
            </View>
            <View className='perms-row'>
              <Text className='perms-row__key'>可分享</Text>
              <Text className={`perms-row__val ${info.permissions.shareable ? '' : 'perms-row__val--off'}`}>
                {info.permissions.shareable ? '允许' : '否'}
              </Text>
            </View>
            {info.permissions.canOperate && info.permissions.operationWhitelist.length > 0 ? (
              <View className='perms-row perms-row--stacked'>
                <Text className='perms-row__key'>允许操作</Text>
                <Text className='perms-row__val'>
                  {info.permissions.operationWhitelist.join(' · ')}
                </Text>
              </View>
            ) : null}
          </View>

          {err ? <Text className='redeem-form__err'>{err}</Text> : null}

          <Button
            className='redeem-form__btn'
            loading={redeeming}
            disabled={redeeming}
            onClick={handleRedeem}
          >
            <Text className='redeem-form__btn-text'>
              {redeeming ? '兑换中' : '确认兑换'}
            </Text>
            <Text className='redeem-form__btn-arrow'>→</Text>
          </Button>

          <Button
            className='redeem-form__btn redeem-form__btn--ghost'
            disabled={redeeming}
            onClick={handleBackToEdit}
          >
            <Text>← 重新输入</Text>
          </Button>
        </View>
      )}

      {stage === 'redeemed' && (
        <View className='redeem-done'>
          <Text className='redeem-done__seal'>§ · 已绑定</Text>
          <Text className='redeem-done__title'>兑换成功</Text>
          <Text className='redeem-done__hint'>即将跳转到「我的认养」...</Text>
        </View>
      )}
    </View>
  )
}
