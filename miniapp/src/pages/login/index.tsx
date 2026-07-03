import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { wechatLogin } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §0 · 登录页 (生产链路 · 真微信 code2session 版)
 * ============================================================
 *  1. onLoad: 已有 token 直跳 /pages/adoptions/index
 *  2. 点"微信一键登录":
 *      · Taro.login() 拿到一次性 code (5 分钟过期, 与 appId 绑定)
 *      · POST /auth/wechat-login {code}  → 后端 WxMaService.getSessionInfo()
 *        → openid (+ unionid) → 找/建 user → 下发 satoken
 *      · setAuth + switchTab /pages/adoptions/index
 *
 *  历史包袱清理:
 *   · 之前用 `stub_device_id` UUID 当 code 是为了绕开"后端没真接 code2session
 *     时, wx.login() 一次性 code 每次登录都创建新用户" 这个 bug.
 *     现在后端走 jscode2session 拿真 openid → 同设备永远是同一个 userId,
 *     不再需要 stub 锚点. stub 旧锚点仍保留供 adopter-login / operator-login
 *     等 dev 工具入口用 (后端 stub-mode=true 时生效).
 *
 *   · Taro.login() 在 devtools 未登录测试号 / appId 非法 / 真机断网时会挂起,
 *     沿用 3 秒超时兜底, 失败给用户明确提示而不是无限 "Signing in...".
 * ============================================================ */

/**
 * Taro.login() 包了一层超时. 失败 reject, 给上层 try/catch 友好处理.
 */
function wxLoginWithTimeout(ms = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[LoginPage] Taro.login timeout > ${ms}ms`)
      reject(new Error('微信登录超时, 请检查网络'))
    }, ms)
    Taro.login()
      .then((res) => {
        clearTimeout(timer)
        if (!res?.code) {
          reject(new Error(res?.errMsg || '未拿到微信登录 code'))
          return
        }
        resolve(res.code)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(new Error(e?.errMsg || '微信登录失败'))
      })
  })
}
export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string>('')
  const setAuth = useAuthStore((s) => s.setAuth)
  // ref 瞬时锁, 比 state 早一帧生效; 成功路径保持锁到 switchTab 生效
  const loadingRef = useRef(false)
  // 登录成功后 320ms 的导航延迟若期间触发 40002 会清 token,
  // http.ts 拦截器会另发起 redirectTo('/pages/login'), 两次 navigation 互相覆盖,
  // 真机表现为 "登录成功闪一下又弹回登录页". 用 ref 管 timer + 跳转前再校 token.
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useUnload(() => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }
  })

  useLoad(() => {
    // hydrate 已经在 app.tsx 的 useLaunch 跑过, 这里只读
    const { token, userInfo } = useAuthStore.getState()
    if (token) {
      // 角色路由: guest → plot 直入(分享码场景由 guest-login 已 redirect),
      // adopter / operator / agronomist / admin → home
      if (userInfo?.roleType === 'guest') {
        Taro.switchTab({ url: '/pages/me/index' }).catch(() =>
          Taro.redirectTo({ url: '/pages/me/index' }),
        )
      } else {
        Taro.switchTab({ url: '/pages/home/index' }).catch(() =>
          Taro.redirectTo({ url: '/pages/home/index' }),
        )
      }
    }
  })

  async function handleLogin() {
    // ref 锁比 state 早一帧生效, 兑提极快双击
    if (loadingRef.current) return
    loadingRef.current = true
    // 登录成功后还要等 320ms setTimeout 跳转; 这期间保持锁, 防重复登录
    let keepLocked = false
    setLoading(true)
    setErrMsg('')

    const t0 = Date.now()
    try {
      // 1. 拿一次性 wx code (5 分钟过期 · 与 appId 绑定)
      const code = await wxLoginWithTimeout(3000)
      console.log(`[LoginPage] wx.login ok · ${Date.now() - t0}ms · code=${code.slice(0, 6)}***`)

      // 2. 直接发后端 · 后端 jscode2session → openid → user
      const res = await wechatLogin(code)
      console.log(`[LoginPage] wechatLogin ok · total ${Date.now() - t0}ms · userId=${res.userInfo?.userId}`)
      setAuth(res.token, res.userInfo)

      // 3. 跳转决策:
      //    · 新用户 (bindNickname=false) → 强制 redirectTo /pages/setup-nickname
      //    · 老用户 → switchTab /pages/adoptions/index
      const needSetupNickname = res.userInfo?.bindNickname === false
      Taro.showToast({
        title: needSetupNickname ? '请设置昵称' : '登录成功',
        icon: 'success',
        duration: 800,
      })
      keepLocked = true
      // ref 托管 timer + 跳转前再校 token. 若期间 40002 清 token 则放弃本次导航,
      // 避免和拦截器发起的 redirectTo 竞态
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null
        void (async () => {
          if (!useAuthStore.getState().token) {
            console.warn('[LoginPage] token lost during navigate delay · abort switchTab')
            keepLocked = false
            loadingRef.current = false
            setLoading(false)
            return
          }

          // §A · 新用户 · 强制流程不允许 switchTab (setup-nickname 不是 tabBar 页)
          if (needSetupNickname) {
            try {
              await Taro.redirectTo({ url: '/pages/setup-nickname/index' })
            } catch (e1) {
              console.error('[LoginPage] redirectTo setup-nickname failed', e1)
              try {
                await Taro.reLaunch({ url: '/pages/setup-nickname/index' })
              } catch (e2) {
                console.error('[LoginPage] reLaunch setup-nickname failed · stay on login', e2)
                keepLocked = false
                loadingRef.current = false
                setLoading(false)
              }
            }
            return
          }

          // §B · 老用户 · 角色感知入口 (guest 进 me, 其他进 home)
          const targetTab =
            res.userInfo?.roleType === 'guest'
              ? '/pages/me/index'
              : '/pages/home/index'
          try {
            await Taro.switchTab({ url: targetTab })
          } catch (e1) {
            console.warn('[LoginPage] switchTab failed · fallback redirectTo', e1)
            try {
              await Taro.redirectTo({ url: targetTab })
            } catch (e2) {
              console.error('[LoginPage] redirectTo failed · fallback reLaunch', e2)
              try {
                await Taro.reLaunch({ url: targetTab })
              } catch (e3) {
                console.error('[LoginPage] reLaunch failed · user stays on login', e3)
                keepLocked = false
                loadingRef.current = false
                setLoading(false)
              }
            }
          }
        })()
      }, 320)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败'
      setErrMsg(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      // 失败路径释放锁让用户重试; 成功路径保持到页面 unload
      if (!keepLocked) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }

  return (
    <View className='login-page'>
      <BrandNavBar hideBack />
      {/* --- Hero · 纯排版, 无卡片 --- */}
      <View className='login-hero'>
        <Text className='login-hero__title'>陇上管家</Text>
        <Text className='login-hero__lede'>认养一块田，看它慢慢长大</Text>
        <Text className='login-hero__points'>实时监测 · 远程看田 · 可信溯源</Text>
      </View>

      {errMsg ? <Text className='login-err'>{errMsg}</Text> : null}

      {/* --- 底部 · 单主按钮 + 文字次级入口 --- */}
      <View className='login-bottom'>
        <Button
          className='login-cta'
          loading={loading}
          disabled={loading}
          onClick={handleLogin}
        >
          {loading ? '进入中…' : '微信一键登录'}
        </Button>

        <View className='login-links'>
          <Text
            className='login-links__item'
            onClick={() => !loading && Taro.navigateTo({ url: '/pages/adopter-login/index' })}
          >
            认养用户
          </Text>
          <Text className='login-links__dot'>·</Text>
          <Text
            className='login-links__item'
            onClick={() => !loading && Taro.navigateTo({ url: '/pages/operator-login/index' })}
          >
            操作员
          </Text>
          <Text className='login-links__dot'>·</Text>
          <Text
            className='login-links__item'
            onClick={() => !loading && Taro.navigateTo({ url: '/pages/guest-login/index' })}
          >
            分享码访问
          </Text>
        </View>

        <Text className='login-terms'>
          继续即同意{' '}
          <Text
            className='login-link login-link--soon'
            onClick={() => Taro.showToast({ title: '服务协议 · 即将上线', icon: 'none', duration: 1500 })}
          >
            服务协议
          </Text>
          {'  ·  '}
          <Text
            className='login-link login-link--soon'
            onClick={() => Taro.showToast({ title: '隐私政策 · 即将上线', icon: 'none', duration: 1500 })}
          >
            隐私政策
          </Text>
        </Text>
      </View>
    </View>
  )
}
