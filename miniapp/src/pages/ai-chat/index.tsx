import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useRouter, useDidShow, useUnload } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import {
  aiChat,
  aiCreateTask,
  genSessionId,
  INTENT_LABEL,
} from '@/api/ai'
import { useAuthStore } from '@/store/auth'
import { useRequireRole } from '@/hooks/useRequireRole'
import type { AiChatResponse } from '@/types'
import './index.scss'

/**
 * §6 · AI 问答 · Folio 风对话
 * ============================================================
 *  入口: /pages/ai-chat/index?plotId=X&plotName=Y
 *
 *  数据流:
 *    用户输入 → POST /ai/chat (sessionId + plotId + message)
 *    → AiChatResponse · 塞进消息列表
 *    → 若 needConfirm · 气泡下方出「确认执行」按钮
 *    → 点确认 → POST /ai/actions/create-operation-task
 *    → 成功 → 跳 /pages/task-detail
 * ============================================================ */

interface UserMessage {
  kind: 'user'
  id: string
  text: string
}

interface AiMessage {
  kind: 'ai'
  id: string
  response: AiChatResponse
}

interface SystemMessage {
  kind: 'system'
  id: string
  text: string
  tone?: 'ok' | 'err'
}

type ChatMessage = UserMessage | AiMessage | SystemMessage

export default function AiChatPage() {
  const router = useRouter()
  const plotId = Number(router.params.plotId || 0)
  let plotName = `地块 #${plotId}`
  if (router.params.plotName) {
    try {
      plotName = decodeURIComponent(router.params.plotName)
    } catch {
      plotName = router.params.plotName
    }
  }

  const sessionIdRef = useRef<string>(genSessionId())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  // M4 · ref 瞬时锁 (state 有一帧延迟, 极快双击会穿透)
  const sendingRef = useRef(false)
  const confirmingRef = useRef(false)
  // FIX · aiCreateTask 成功后 600ms 再跳 task-detail. 若用户期间 navigateBack,
  //   计时器仍会 navigateTo 错位. 用 ref 存 timer id, useUnload 清理.
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // M1 · scrollToBottom 的 setTimeout 未 cleanup, 用户连发多条后立刻退出 →
  //       累计的 setTimeout 在已卸载组件上 setState, 控制台刷 unmounted 警告.
  //       用 ref 管理, 每次新调先平旧 timer, unload 时统一清.
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // G2 · M2 角色闸门抽到 hook:
  //      operator 角色不能进入地块维度 AI 对话 (后端 /ai/chat 会走 AccessScopeService,
  //      operator 在该 plot 没有 AdoptionCode → PLOT_ACCESS_DENIED).
  //      preferNavigateBack: 从 plot 详情跳进来的场景, 优先退回原页不强推 workbench.
  useRequireRole(['adopter', 'guest'], { preferNavigateBack: true })

  useLoad(() => {
    // G2 hook 已管 token + operator 角色守卫, 这里只负责业务初始化
    if (!plotId) {
      pushSystem('参数缺失 · plotId', 'err')
      return
    }
    pushSystem(`· ${plotName} · session ${sessionIdRef.current.slice(-6)}`)
    pushWelcome()
  })

  // N34 · handleConfirm 成功路径 keepLocked=true 不释放 ref 是为了覆盖 600ms
  //       setTimeout → navigateTo 的 gap. 但小程序 navigateTo 保留当前页在栈上,
  //       用户从 task-detail navigateBack 回来时 confirming lock + UI 都卡着.
  //       onShow 时强制重置两者.
  useDidShow(() => {
    if (confirmingRef.current || confirming !== null) {
      confirmingRef.current = false
      setConfirming(null)
    }
  })

  useUnload(() => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
  })

  function pushUser(text: string) {
    setMessages((prev) => [
      ...prev,
      { kind: 'user', id: mkId('u'), text },
    ])
    scrollToBottom()
  }

  function pushAi(response: AiChatResponse) {
    setMessages((prev) => [
      ...prev,
      { kind: 'ai', id: mkId('a'), response },
    ])
    scrollToBottom()
  }

  function pushSystem(text: string, tone?: 'ok' | 'err') {
    setMessages((prev) => [
      ...prev,
      { kind: 'system', id: mkId('s'), text, tone },
    ])
    scrollToBottom()
  }

  function pushWelcome() {
    setMessages((prev) => [
      ...prev,
      {
        kind: 'ai',
        id: 'welcome',
        response: {
          sessionId: sessionIdRef.current,
          intent: 'general_query',
          targetPlotId: plotId,
          targetDeviceId: null,
          action: null,
          params: null,
          needConfirm: false,
          permissionCheck: true,
          schedulingMode: null,
          riskLevel: 'low',
          reply: `你好, 这里是 ${plotName} 的 AI 农技助手. 可以问我:\n· 当前传感数据解读\n· 是否该浇水 / 施肥 / 喷淋\n· 作物生长阶段建议`,
          suggestion: null,
        },
      },
    ])
  }

  function scrollToBottom() {
    // M1 · ref 托管; 每次先平旧 timer, unload 时统一清; 避免 unmount 后 setState
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      setScrollTop((t) => t + 99999)
    }, 50)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || !plotId) return
    // M4 · ref 锁比 state 早一帧, 兑提极快双击
    if (sendingRef.current) return
    sendingRef.current = true
    // 保留原始输入, 失败时恢复
    const originalInput = input
    setInput('')
    setSending(true)
    pushUser(text)

    try {
      const resp = await aiChat({
        sessionId: sessionIdRef.current,
        plotId,
        message: text,
      })
      pushAi(resp)
    } catch (e) {
      pushSystem(
        e instanceof Error ? e.message : 'AI 服务暂不可用, 请稍后再试',
        'err',
      )
      // N26 · 发送失败把长文本还回输入框, 让用户能重发而不用重打
      setInput(originalInput)
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  async function handleConfirm(msg: AiMessage) {
    const r = msg.response
    if (!r.needConfirm || !r.targetDeviceId || !r.action) return
    // M4 · ref 锁比 state 早一帧生效, 阻断极快双击
    if (confirmingRef.current) return
    confirmingRef.current = true
    // L1 · 成功路径持续锁住到页面跳走; 失败/取消路径由 finally 释放
    let keepLocked = false

    try {
      const ok = await Taro.showModal({
        title: '确认创建任务?',
        content: `${INTENT_LABEL[r.action] || r.action} · 地块 ${plotName}`,
        confirmText: '创建',
        cancelText: '再想想',
      })
      if (!ok.confirm) return

      setConfirming(msg.id)
      try {
        const task = await aiCreateTask({
          sessionId: r.sessionId,
          plotId: r.targetPlotId,
          deviceId: r.targetDeviceId,
          actionType: r.action,
          actionParams: r.params || {},
        })
        pushSystem(`任务已创建 · ${task.taskNo}`, 'ok')
        Taro.showToast({ title: '任务已提交', icon: 'success', duration: 900 })
        // L1 · setTimeout 的 600ms 间隙保持锁, 防止期间点别条 bubble CTA 重复建任务.
        //      导航后当前页 unload, ref 对象会随组件卸载被 GC, 无需手动复位.
        keepLocked = true
        if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
        navigateTimerRef.current = setTimeout(() => {
          navigateTimerRef.current = null
          Taro.navigateTo({
            url: `/pages/task-detail/index?taskId=${task.taskId}`,
          })
        }, 600)
      } catch (e) {
        pushSystem(
          e instanceof Error ? e.message : 'AI 创建任务失败',
          'err',
        )
        setConfirming(null)
      }
    } finally {
      if (!keepLocked) confirmingRef.current = false
    }
  }

  const quickHints = useMemo(
    () => [
      '当前数据看需要浇水吗?',
      '下一步农事建议?',
      '是否有风险预警?',
      '帮我施肥',
    ],
    [],
  )

  function onHintTap(hint: string) {
    if (sending) return
    setInput(hint)
  }

  return (
    <View className='ai-page'>
      {/* --- 页头 --- */}
      <View className='ai-head'>
        <Text className='ai-head__seal'>§ 06 · AI 助手</Text>
        <Text className='ai-head__title'>AI 农技助手</Text>
        <Text className='ai-head__lede'>— {plotName}</Text>
      </View>

      {/* --- 对话滚动区 --- */}
      <ScrollView
        className='ai-scroll'
        scrollY
        scrollTop={scrollTop}
        scrollWithAnimation
        enhanced
        showScrollbar={false}
      >
        <View className='ai-thread'>
          {messages.map((m) => {
            if (m.kind === 'user') {
              return (
                <View key={m.id} className='bubble bubble--user'>
                  <Text className='bubble__text'>{m.text}</Text>
                </View>
              )
            }
            if (m.kind === 'system') {
              return (
                <Text
                  key={m.id}
                  className={`bubble-sys ${m.tone ? `bubble-sys--${m.tone}` : ''}`}
                >
                  {m.text}
                </Text>
              )
            }
            return (
              <AiBubble
                key={m.id}
                msg={m}
                isConfirming={confirming === m.id}
                onConfirm={() => handleConfirm(m)}
              />
            )
          })}
          {sending ? (
            <View className='bubble bubble--ai bubble--loading'>
              <Text className='bubble__text'>思考中 …</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* --- 快捷提问 --- */}
      <View className='ai-hints'>
        {quickHints.map((h) => (
          <Text key={h} className='ai-hints__item' onClick={() => onHintTap(h)}>
            {h}
          </Text>
        ))}
      </View>

      {/* --- 输入区 --- */}
      <View className='ai-input'>
        <Input
          className='ai-input__field'
          value={input}
          placeholder='问问当前地块的农事'
          placeholderClass='ai-input__placeholder'
          maxlength={200}
          disabled={sending}
          onInput={(e: { detail: { value: string } }) => setInput(e.detail.value)}
          confirmType='send'
          onConfirm={handleSend}
        />
        <Button
          className='ai-input__send'
          disabled={sending || !input.trim()}
          onClick={handleSend}
        >
          <Text className='ai-input__send-text'>{sending ? '…' : 'SEND'}</Text>
        </Button>
      </View>
    </View>
  )
}

// ---- AI 气泡小组件 ----
function AiBubble({
  msg,
  isConfirming,
  onConfirm,
}: {
  msg: AiMessage
  isConfirming: boolean
  onConfirm: () => void
}) {
  const r = msg.response
  const intentLabel = INTENT_LABEL[r.intent] || r.intent

  return (
    <View className='bubble bubble--ai'>
      {r.intent !== 'general_query' ? (
        <View className='bubble__head'>
          <Text className='bubble__intent'>意图 · {intentLabel}</Text>
          <Text className={`folio-tag folio-tag--${riskTone(r.riskLevel)}`}>
            {riskLabel(r.riskLevel)}
          </Text>
        </View>
      ) : null}

      <Text className='bubble__text'>{r.reply}</Text>

      {r.suggestion ? (
        <Text className='bubble__hint'>— {r.suggestion}</Text>
      ) : null}

      {r.needConfirm && r.targetDeviceId && r.action ? (
        // 注: handleConfirm 要求 needConfirm + targetDeviceId + action 三者齐全,
        //     渲染条件必须与其保持一致, 否则 action=null 时按钮可点但静默无效.
        <Button
          className='bubble__cta'
          disabled={isConfirming}
          onClick={onConfirm}
        >
          <Text className='bubble__cta-text'>
            {isConfirming ? '创建中 …' : `确认 · ${intentLabel}`}
          </Text>
          <Text className='bubble__cta-arrow'>→</Text>
        </Button>
      ) : null}

      {!r.permissionCheck ? (
        <Text className='bubble__warn'>· 该操作被安全系统拦截, 无法执行</Text>
      ) : null}
    </View>
  )
}

// ---- 辅助 ----
function mkId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function riskLabel(r: string): string {
  if (r === 'high') return 'HIGH'
  if (r === 'medium') return 'MEDIUM'
  return 'LOW'
}

function riskTone(r: string): string {
  if (r === 'high') return 'clay'
  if (r === 'medium') return 'sand'
  return 'sage'
}
