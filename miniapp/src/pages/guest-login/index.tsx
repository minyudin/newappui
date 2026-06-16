import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { guestLogin } from '@/api/auth'
import { verifyAdoptionCode } from '@/api/adoption'
import { useAuthStore } from '@/store/auth'
import './index.scss'

function normalizeCode(v: string): string {
  return (v || '').trim().replace(/\s+/g, '').toUpperCase()
}

export default function GuestLoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const [hint, setHint] = useState('')

  const placeholder = useMemo(() => '请输入分享码，例如：SHARE-1A2B3C4D', [])
  const normalizedCode = useMemo(() => normalizeCode(code), [code])
  const canSubmit = Boolean(normalizedCode) && !loading
  const stateLine = useMemo(
    () => (normalizedCode ? `当前分享码: ${normalizedCode}` : '请输入分享码后继续'),
    [normalizedCode],
  )

  useLoad((opts) => {
    const preset = normalizeCode((opts as { code?: string }).code || '')
    if (preset) setCode(preset)
  })

  async function handleEnter() {
    const c = normalizeCode(code)
    if (!c || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setHint('')
    try {
      // 1) 先做预校验（无需登录）拿 plotId + 权限预览
      const verified = await verifyAdoptionCode(c)
      if (!verified?.valid || !verified.plotId) {
        throw new Error('分享码无效或已过期')
      }
      if (verified.codeType !== 'guest' && verified.codeType !== 'share') {
        throw new Error('该码不是分享访问码')
      }

      // 2) guest 登录拿 token
      const res = await guestLogin(c)
      setAuth(res.token, res.userInfo)

      // 3) 直接进地块详情（只读权限由后端 access-scope 控制）
      const plotName = encodeURIComponent(`分享访问 · #${verified.plotId}`)
      await Taro.redirectTo({
        url: `/pages/plot/index?plotId=${verified.plotId}&plotName=${plotName}`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '进入失败'
      setHint(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  return (
    <View className='guest-login-page'>
      <View className='guest-login-page__body'>
      <View className='guest-login-head'>
        <Text className='guest-login-head__seal'>§ · 访客</Text>
        <Text className='guest-login-head__title'>分享码访问</Text>
        <Text className='guest-login-head__lede'>— 仅查看权限 · 不可操作</Text>
        <Text className='guest-login-head__state'>{stateLine}</Text>
      </View>

      <View className='guest-login-card'>
        <Text className='guest-login-card__label'>分享码</Text>
        <Input
          className='guest-login-card__input'
          value={code}
          placeholder={placeholder}
          maxlength={64}
          disabled={loading}
          onInput={(e: { detail: { value: string } }) => setCode(e.detail.value)}
          confirmType='go'
          onConfirm={handleEnter}
        />
        <Text className='guest-login-card__tip'>仅支持分享访问码，如 SHARE-XXXX</Text>
        {hint ? <Text className='guest-login-card__hint'>! {hint}</Text> : null}

        <Button
          className='guest-login-card__btn'
          disabled={!canSubmit}
          loading={loading}
          onClick={handleEnter}
        >
          <Text>{loading ? '进入中…' : '进入查看'}</Text>
        </Button>

        <View className='guest-login-card__back' onClick={() => Taro.redirectTo({ url: '/pages/login/index' })}>
          <Text className='guest-login-card__back-text'>← 返回登录首页</Text>
        </View>
      </View>
      </View>
    </View>
  )
}

