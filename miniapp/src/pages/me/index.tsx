import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { Dialog } from '@nutui/nutui-react-taro'
import { useRef, useState } from 'react'
import { getCurrentUser, logout } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import type { UserInfo } from '@/types'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §03 · 我的 (TabBar 第三页)
 * ============================================================
 *  - 未登录 → 重定向 /pages/login
 *  - 登录态展示 身份信息 + 设置 (占位) + 退出登录 (二次确认)
 * ============================================================ */
export default function MePage() {
  const userInfo = useAuthStore((s) => s.userInfo)
  const setUserInfo = useAuthStore((s) => s.setUserInfo)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false)
  // M4 · ref 瞬时锁, 防 modal 关闭前双击触发两次 logout 请求
  const logoutPendingRef = useRef(false)

  useLoad(() => {
    const token = useAuthStore.getState().token
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    refreshUser()
  })

  // 切回 tab 时: 1) 主动推 tabBar 选中 idx=2 · 2) 兜底 token 检查
  useDidShow(() => {
    Taro.eventCenter.trigger(TAB_BAR_SYNC_EVT, '/pages/me/index')
    const token = useAuthStore.getState().token
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
  })

  async function refreshUser() {
    try {
      const me = await getCurrentUser()
      setUserInfo(me)
    } catch {
      // 静默 · 依赖旧缓存
    }
  }

  async function handleLogout() {
    if (logoutPendingRef.current) return
    logoutPendingRef.current = true
    try {
      setLogoutPending(true)
      try {
        await logout()
      } catch {
        // ignore
      }
      clearAuth()
      // adoptions 的模块级缓存由其内部按 userId 自动失效, 这里无需再手动清
      Taro.redirectTo({ url: '/pages/login/index' })
    } finally {
      logoutPendingRef.current = false
      // state 恢复留给 UI; redirectTo 后当前页 unload, 这里丢不掉 warn
      setLogoutPending(false)
    }
  }

  return (
    <View className='me-page'>
      <BrandNavBar />
      {/* --- 页头 · Folio 封面 --- */}
      <View className='me-head'>
        <Text className='me-head__seal'>§ 03 · 我的</Text>
        <Text className='me-head__title'>我的</Text>
        <Text className='me-head__lede'>— 账号 · 设置 · 退出</Text>
      </View>

      {/* --- 身份块 --- */}
      <View className='me-identity'>
        <View className='me-identity__avatar'>
          <Text className='me-identity__avatar-char'>
            {userInfo?.nickname?.[0] || '人'}
          </Text>
        </View>
        <View className='me-identity__info'>
          <Text className='me-identity__name'>
            {userInfo?.nickname || '未登录'}
          </Text>
          <Text className='me-identity__role'>
            {roleLabel(userInfo?.roleType)} {userInfo?.userNo ? `· ${userInfo.userNo}` : ''}
          </Text>
          {userInfo?.mobile ? (
            <Text className='me-identity__meta'>
              手机 · {maskMobile(userInfo.mobile)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* --- §01 · 账户明细 --- */}
      <View className='me-section'>
        <Text className='me-section__title'>§ 01 · 账户</Text>
        <MeRow k='用户 ID' v={userInfo?.userId ? `#${userInfo.userId}` : '—'} mono />
        <MeRow k='编号'    v={userInfo?.userNo || '—'} mono />
        <View
          className='me-row me-row--clickable'
          onClick={() =>
            Taro.navigateTo({ url: '/pages/setup-nickname/index?mode=edit' })
          }
        >
          <Text className='me-row__key'>昵称</Text>
          <View className='me-row__val-group'>
            <Text className='me-row__val'>{userInfo?.nickname || '—'}</Text>
            <Text className='me-row__edit'>修改 →</Text>
          </View>
        </View>
        <MeRow k='手机'    v={userInfo?.mobile ? maskMobile(userInfo.mobile) : '未绑定'} mono />
        <MeRow k='角色'    v={roleLabel(userInfo?.roleType)} />
      </View>

      {/* --- §02 · 设置 (占位) --- */}
      <View className='me-section'>
        <Text className='me-section__title'>§ 02 · 设置</Text>
        {userInfo?.roleType === 'operator' ? (
          <View
            className='me-nav'
            onClick={() =>
              Taro.switchTab({ url: '/pages/operator-workbench/index' }).catch(() => {
                Taro.redirectTo({ url: '/pages/operator-workbench/index' }).catch(() => {})
              })
            }
          >
            <Text className='me-nav__key'>运营工作台</Text>
            <Text className='me-nav__arrow'>→</Text>
          </View>
        ) : null}
        {/* §02 · 设置: 当前版本未启用的占位项统一走 `me-nav--soon` 灰度样式, */}
        {/* 右侧以 "即将上线" 小标代替箭头, 避免用户误以为是可用但坏掉的入口. */}
        <View className='me-nav me-nav--soon' onClick={() => showSoon('消息通知')}>
          <Text className='me-nav__key'>消息通知</Text>
          <Text className='me-nav__flag'>即将上线</Text>
        </View>
        <View className='me-nav me-nav--soon' onClick={() => showSoon('服务协议')}>
          <Text className='me-nav__key'>服务协议</Text>
          <Text className='me-nav__flag'>即将上线</Text>
        </View>
        <View className='me-nav me-nav--soon' onClick={() => showSoon('隐私政策')}>
          <Text className='me-nav__key'>隐私政策</Text>
          <Text className='me-nav__flag'>即将上线</Text>
        </View>
        <View className='me-nav me-nav--soon' onClick={() => showSoon('关于陇上管家')}>
          <Text className='me-nav__key'>关于</Text>
          <Text className='me-nav__flag'>即将上线</Text>
        </View>
      </View>

      {/* --- 退出登录 --- */}
      <Button
        className='me-logout'
        disabled={logoutPending}
        onClick={() => setLogoutConfirmVisible(true)}
      >
        <Text className='me-logout__text'>
          {logoutPending ? '退出中…' : '退出登录'}
        </Text>
      </Button>

      <Dialog
        visible={logoutConfirmVisible}
        title='确认退出登录?'
        confirmText='退出'
        cancelText='取消'
        onConfirm={() => {
          setLogoutConfirmVisible(false)
          handleLogout()
        }}
        onCancel={() => setLogoutConfirmVisible(false)}
      >
        退出后需重新用微信登录
      </Dialog>

      {/* --- 版本号 --- */}
      <Text className='me-footer'>陇上管家 · v0.1.0</Text>
    </View>
  )
}

// ---- 小组件: meta 行 ----
function MeRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View className='me-row'>
      <Text className='me-row__key'>{k}</Text>
      <Text className={`me-row__val ${mono ? 'me-row__val--mono' : ''}`}>{v}</Text>
    </View>
  )
}

// ---- 辅助 ----
function roleLabel(role: UserInfo['roleType'] | undefined): string {
  if (!role) return '未知'
  const MAP: Record<string, string> = {
    adopter: '认养人',
    guest: '访客',
    admin: '管理员',
    operator: '操作员',
    agronomist: '农艺师',
    ai_agent: 'AI 助手',
    edge_node: '边缘节点',
  }
  return MAP[role] || role
}

function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile
  return `${mobile.slice(0, 3)} **** ${mobile.slice(-4)}`
}

function showSoon(name: string) {
  Taro.showToast({ title: `${name} · 即将上线`, icon: 'none', duration: 1500 })
}
