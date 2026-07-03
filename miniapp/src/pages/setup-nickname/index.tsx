import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useLoad, useUnload, useRouter } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { changeNickname, checkNicknameAvailability, setupNickname } from '@/api/auth'
import { useAuthStore } from '@/store/auth'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §0.5 · 注册补昵称 / 改昵称 · 双模式复用
 * ============================================================
 *  入口 1 (mode=setup, 默认): 主登录成功后, 若 userInfo.bindNickname=false 被强制 redirectTo 过来
 *  入口 2 (mode=edit): pages/me 点击"昵称"行, navigateTo 过来
 *
 *  状态机:
 *    idle    · 输入框空 / 用户没动
 *    typing  · 用户输入中, 防抖 600ms 后触发 check-nickname
 *    checking· 正在调 check-nickname
 *    ok      · 可用, 提交按钮高亮
 *    invalid · 合规错 / 已占用, 错误信息红字
 *    submitting· 提交中
 *
 *  规则 (与后端 NicknameValidator 一致):
 *   · 长度 2~16
 *   · 中英数下划线空格
 *   · 拒"用户/游客XXXXXX" 系统格式
 *   · 全平台唯一 (uk_nickname)
 *
 *  setup 模式不允许 navigateBack 直接回登录页 (会绕过强制流程):
 *    · 用户若不想填, 可"退出登录" → 自然回到登录页
 *  edit 模式允许 navigateBack 回 pages/me, 不必强制提交
 * ============================================================ */

const MIN_LEN = 2
const MAX_LEN = 16

/** 客户端预校验 · 与后端 NicknameValidator 同一规则 */
function preValidate(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!s) return '昵称不能为空'
  // codepoint 长度: emoji / 罕见字 才会让长度计数错位, 这里用 [...str].length
  const cp = [...s].length
  if (cp < MIN_LEN) return `昵称至少 ${MIN_LEN} 个字符`
  if (cp > MAX_LEN) return `昵称不能超过 ${MAX_LEN} 个字符`
  if (!/^[\p{L}\p{N}_ ]+$/u.test(s)) return '昵称仅支持中英文/数字/下划线/空格'
  if (/^(用户|游客)\d{4,8}$/.test(s)) return '请勿使用系统默认昵称格式'
  return null
}

export default function SetupNicknamePage() {
  const router = useRouter()
  const isEdit = router.params?.mode === 'edit'
  const setUserInfo = useAuthStore((s) => s.setUserInfo)
  const userInfo = useAuthStore((s) => s.userInfo)
  const [nickname, setNickname] = useState(isEdit ? (userInfo?.nickname ?? '') : '')
  // 状态: idle / typing / checking / ok / invalid
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'invalid'>('idle')
  const [hint, setHint] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const checkSeqRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 跳转 timer · 提交成功后给 toast 一帧再 switchTab
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stateLabel = useMemo(() => {
    if (state === 'checking') return '检查中…'
    if (state === 'ok') return '可用'
    if (state === 'invalid') return hint
    return '请输入 2~16 个字符的昵称'
  }, [state, hint])

  useLoad(() => {
    // 防绕路: 没 token 直跳登录
    const { token, userInfo: u } = useAuthStore.getState()
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    // setup 模式: 已经有昵称的不应该来这页, 直跳认养
    // edit 模式: 任何登录用户都可以进来 (改名)
    if (!isEdit && u?.bindNickname) {
      Taro.switchTab({ url: '/pages/adoptions/index' }).catch(() =>
        Taro.redirectTo({ url: '/pages/adoptions/index' }),
      )
    }
  })

  useUnload(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
  })

  /** 输入框变更 · 客户端预校验 → 通过则防抖 600ms 调后端 check-nickname */
  function onInputChange(v: string) {
    setNickname(v)
    setState('idle')
    setHint('')
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = v.trim()
    if (!trimmed) return
    const err = preValidate(trimmed)
    if (err) {
      setState('invalid')
      setHint(err)
      return
    }

    setState('checking')
    setHint('')
    debounceRef.current = setTimeout(() => {
      const seq = ++checkSeqRef.current
      checkNicknameAvailability(trimmed)
        .then((res) => {
          // 代际守卫: 后发先到时丢弃旧结果
          if (seq !== checkSeqRef.current) return
          if (res.available) {
            setState('ok')
            setHint(res.normalized && res.normalized !== trimmed ? `将保存为: ${res.normalized}` : '')
          } else {
            setState('invalid')
            setHint(res.reason || '昵称不可用')
          }
        })
        .catch(() => {
          // 网络错: 不阻拦, 让用户继续提交, 后端兜底
          if (seq !== checkSeqRef.current) return
          setState('idle')
          setHint('')
        })
    }, 600)
  }

  async function handleSubmit() {
    if (submittingRef.current) return
    const trimmed = nickname.trim()
    const err = preValidate(trimmed)
    if (err) {
      setState('invalid')
      setHint(err)
      return
    }
    // edit 模式: 与当前昵称完全一致 → 直接返回, 不调后端
    if (isEdit && trimmed === (userInfo?.nickname ?? '')) {
      Taro.showToast({ title: '昵称未改变', icon: 'none', duration: 800 })
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      const fresh = isEdit
        ? await changeNickname(trimmed)
        : await setupNickname(trimmed)
      setUserInfo(fresh)
      Taro.showToast({ title: '昵称已保存', icon: 'success', duration: 800 })
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        if (isEdit) {
          // edit 模式: 回 pages/me
          Taro.navigateBack({ delta: 1 }).catch(() =>
            Taro.switchTab({ url: '/pages/me/index' }),
          )
        } else {
          // setup 模式: 跳认养列表
          Taro.switchTab({ url: '/pages/adoptions/index' }).catch(() =>
            Taro.redirectTo({ url: '/pages/adoptions/index' }),
          )
        }
      }, 320)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提交失败'
      setState('invalid')
      setHint(msg)
      Taro.showToast({ title: msg, icon: 'none' })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function handleLogout() {
    // setup 模式: 用户拒填 · 提供"退出登录回首页"出口, 不直接 navigateBack 防绕过
    useAuthStore.getState().clearAuth()
    Taro.redirectTo({ url: '/pages/login/index' })
  }

  function handleCancelEdit() {
    // edit 模式: 直接返回 pages/me
    Taro.navigateBack({ delta: 1 }).catch(() =>
      Taro.switchTab({ url: '/pages/me/index' }),
    )
  }

  const canSubmit = state === 'ok' && !submitting

  return (
    <View className='setup-nick-page'>
      <BrandNavBar />
      <View className='setup-nick-page__body'>
        <View className='setup-nick-head'>
          <Text className='setup-nick-head__seal'>
            {isEdit ? '§ 03 · 设置' : '§ 00 · 注册'}
          </Text>
          <Text className='setup-nick-head__title'>
            {isEdit ? '修改昵称' : '给自己起个名字'}
          </Text>
          <Text className='setup-nick-head__lede'>
            — {userInfo?.userNo ? `编号 ${userInfo.userNo}` : '欢迎使用陇上管家'}
          </Text>
          <Text className='setup-nick-head__hint'>
            {isEdit
              ? '昵称将作为你在平台的唯一标识 · 全平台不可重复'
              : '昵称将作为你在平台的唯一标识 · 全平台不可重复'}
          </Text>
        </View>

        <View className='setup-nick-card'>
          <Text className='setup-nick-card__label'>昵称</Text>
          <Input
            className={`setup-nick-card__input setup-nick-card__input--${state}`}
            value={nickname}
            placeholder='2~16 个字符 · 中英数/下划线/空格'
            placeholderClass='setup-nick-card__placeholder'
            maxlength={MAX_LEN}
            disabled={submitting}
            onInput={(e: { detail: { value: string } }) => onInputChange(e.detail.value)}
            confirmType='done'
            onConfirm={handleSubmit}
          />
          <Text className={`setup-nick-card__state setup-nick-card__state--${state}`}>
            {stateLabel}
          </Text>

          <Button
            className='setup-nick-card__btn'
            disabled={!canSubmit}
            loading={submitting}
            onClick={handleSubmit}
          >
            <Text>
              {submitting ? '保存中…' : isEdit ? '保存' : '完成注册'}
            </Text>
          </Button>

          <View
            className='setup-nick-card__foot'
            onClick={isEdit ? handleCancelEdit : handleLogout}
          >
            <Text className='setup-nick-card__foot-text'>
              {isEdit ? '取消, 返回 →' : '暂不注册, 退出登录 →'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
