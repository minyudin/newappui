import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { wechatLogin } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import './index.scss'

const STUB_DEVICE_KEY = 'stub_device_id'

function normalize(v: string): string {
  return (v || '').trim().replace(/\s+/g, '')
}

export default function AdopterLoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [id, setId] = useState('')
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const [hint, setHint] = useState('')
  // S3 · ref 托管登录后的跳转延时器, unload 时清理 + 跳转前再校 token
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const placeholder = useMemo(() => '请输入 adopter 的 stub_device_id，例如：ad_001', [])
  const normalizedId = useMemo(() => normalize(id), [id])
  const canSubmit = Boolean(normalizedId) && !loading
  const stateLine = useMemo(
    () => (normalizedId ? `当前身份: ${normalizedId}` : '请输入身份ID后继续'),
    [normalizedId],
  )

  useLoad(() => {
    try {
      const existing = (Taro.getStorageSync(STUB_DEVICE_KEY) as string) || ''
      if (existing) setId(existing)
    } catch {}
  })

  useUnload(() => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }
  })

  async function handleLogin() {
    const next = normalize(id)
    if (!next || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setHint('')
    try {
      try {
        Taro.setStorageSync(STUB_DEVICE_KEY, next)
      } catch {}

      const res = await wechatLogin(next)
      if (res.userInfo?.roleType !== 'adopter') {
        try {
          Taro.removeStorageSync(STUB_DEVICE_KEY)
        } catch {}
        throw new Error('该身份不是认养用户，请检查输入的 id 是否正确')
      }
      setAuth(res.token, res.userInfo)
      Taro.showToast({ title: '登录成功', icon: 'success', duration: 800 })
      // S3 · ref 托管 timer + 跳转前再校 token, 避免和 http.ts 40002 拦截器抢路由
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null
        if (!useAuthStore.getState().token) return
        Taro.switchTab({ url: '/pages/adoptions/index' }).catch(() =>
          Taro.redirectTo({ url: '/pages/adoptions/index' }),
        )
      }, 450)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败'
      setHint(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  return (
    <View className='ad-login-page'>
      <View className='ad-login-page__body'>
      <View className='ad-login-head'>
        <Text className='ad-login-head__seal'>§ · 认养用户</Text>
        <Text className='ad-login-head__title'>认养用户登录</Text>
        <Text className='ad-login-head__lede'>— 输入身份ID · 进入认养任务视图</Text>
        <Text className='ad-login-head__state'>{stateLine}</Text>
      </View>

      <View className='ad-login-card'>
        <Text className='ad-login-card__label'>身份 ID</Text>
        <Input
          className='ad-login-card__input'
          value={id}
          placeholder={placeholder}
          maxlength={64}
          disabled={loading}
          onInput={(e: { detail: { value: string } }) => setId(e.detail.value)}
          confirmType='go'
          onConfirm={handleLogin}
        />
        <Text className='ad-login-card__tip'>仅支持认养用户身份，如 ad_001</Text>
        {hint ? <Text className='ad-login-card__hint'>! {hint}</Text> : null}

        <Button
          className='ad-login-card__btn'
          disabled={!canSubmit}
          loading={loading}
          onClick={handleLogin}
        >
          <Text>{loading ? '进入中…' : '进入认养页'}</Text>
        </Button>

        <View className='ad-login-card__back' onClick={() => Taro.redirectTo({ url: '/pages/login/index' })}>
          <Text className='ad-login-card__back-text'>← 返回登录首页</Text>
        </View>
      </View>
      </View>
    </View>
  )
}

