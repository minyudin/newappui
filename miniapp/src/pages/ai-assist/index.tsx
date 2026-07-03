import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useUnload } from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { aiGeneralChat, genSessionId, INTENT_LABEL } from '@/api/ai'
import { useRequireRole } from '@/hooks/useRequireRole'
import { useAuthStore } from '@/store/auth'
import type { AiChatResponse } from '@/types'
import { TAB_BAR_SYNC_EVT } from '@/custom-tab-bar/events'
import './index.scss'
import BrandNavBar from '@/components/BrandNavBar'

/**
 * §02 · AI 询问 (Compact Folio 对话)
 * ============================================================
 *  入口: tabBar §02
 *  全局 AI 询问页 (不绑定地块的通用农技问答)
 *
 *  布局:
 *    · 紧凑 § 印章条 (~120rpx) — 与 home 风格一致
 *    · ScrollView 占主屏 (flex:1)
 *    · 空态: 问候语卡 + 4 个推荐问题钉
 *    · 气泡: 用户墨色实心贴右 / AI paper 边框贴左 + 时间序号 + intent 印章
 *    · typing 指示 · 发送中显示 "AI 思考中" 三点呼吸
 *    · 输入区黏底 · 衬线 SEND 大写
 * ============================================================ */

type Msg =
  | { kind: 'user'; id: string; text: string; time: string; seq: number }
  | {
      kind: 'ai'
      id: string
      response: AiChatResponse
      time: string
      seq: number
      // 打字机: typed = 当前已"打"出的字符数, done = 是否打完
      typed: number
      done: boolean
    }
  | { kind: 'system'; id: string; text: string }
  | { kind: 'typing'; id: string }

function mkId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function nowTime(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

const HINTS = [
  '番茄怎么科学浇水?',
  '黄瓜施肥频率建议?',
  '高温天气怎么管理大棚?',
  '常见病虫害怎么预防?',
]

export default function AiAssistPage() {
  const userInfo = useAuthStore((s) => s.userInfo)
  const greetName = userInfo?.nickname || '游客'

  const sessionIdRef = useRef(genSessionId())
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const seqRef = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // adopter / guest / 其他角色都允许使用 (operator 用本页是合法的, 比 hook 限制更宽松)
  useRequireRole(['adopter', 'guest', 'agronomist', 'operator', 'admin'])

  useLoad(() => {
    // 空态由 JSX 渲染 · 不再注入 system 欢迎消息
  })

  useDidShow(() => {
    Taro.eventCenter.trigger(TAB_BAR_SYNC_EVT, '/pages/ai-assist/index')
  })

  useUnload(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
  })

  function scrollToBottom() {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null
      setScrollTop((x) => x + 99999)
    }, 30)
  }

  /**
   * 打字机推进 · 30ms / 字 (中文 codepoint 安全, 用 Array.from 拆 unicode)
   *  · 找 messages 里 done=false 的 AI 项, 推进 typed += 1
   *  · 全部打完时 done=true, 自动停止 interval
   *  · 用户切页 / 发新问题立即 done (handleSend 已处理), 防 timer 残留
   */
  useEffect(() => {
    const hasPending = messages.some(
      (m) => m.kind === 'ai' && !m.done,
    )
    if (!hasPending) return
    const timer = setInterval(() => {
      setMessages((prev) => {
        let advanced = false
        const next = prev.map((m) => {
          if (m.kind !== 'ai' || m.done) return m
          const total = [...m.response.reply].length
          if (m.typed >= total) {
            return { ...m, done: true }
          }
          advanced = true
          // 一帧推进 1 个字符 · 30ms 节奏 → 约 33 字/秒
          // 跟真 ChatGPT 流式速度接近, 中文阅读节奏舒适, 不会让人等太久
          // 1500 字回复约 45 秒, 可接受
          return { ...m, typed: m.typed + 1 }
        })
        if (advanced) {
          // 只在确实有推进时滚动 (避免 done 帧再触发 scroll)
          // 用 microtask 让 setState 先 commit
          Promise.resolve().then(scrollToBottom)
        }
        return next
      })
    }, 30)
    return () => clearInterval(timer)
  }, [messages])

  async function handleSend(directText?: string) {
    const text = (directText ?? input).trim()
    if (!text || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setInput('')

    const seq = ++seqRef.current
    setMessages((prev) => [
      // 把所有未打完的 AI 立即跳到 done · 避免新打字机 timer 与旧的撞
      ...prev.map((m) =>
        m.kind === 'ai' && !m.done
          ? { ...m, typed: [...m.response.reply].length, done: true }
          : m,
      ),
      { kind: 'user', id: mkId('u'), text, time: nowTime(), seq },
      { kind: 'typing', id: 'typing-active' },
    ])
    scrollToBottom()

    try {
      const resp = await aiGeneralChat({
        sessionId: sessionIdRef.current,
        message: text,
      })
      setMessages((prev) => [
        ...prev.filter((m) => m.kind !== 'typing'),
        // typed=0 触发下面 useEffect 启动打字机定时器
        { kind: 'ai', id: mkId('a'), response: resp, time: nowTime(), seq: seqRef.current, typed: 0, done: false },
      ])
      scrollToBottom()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI 服务暂不可用'
      setMessages((prev) => [
        ...prev.filter((m) => m.kind !== 'typing'),
        { kind: 'system', id: mkId('s'), text: msg },
      ])
      setInput(text)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const isEmpty = useMemo(
    () => messages.filter((m) => m.kind !== 'system').length === 0,
    [messages],
  )

  return (
    <View className='ai-page'>
      <BrandNavBar />
      {/* === Hero · 简洁标题 === */}
      <View className='ai-hero'>
        <Text className='ai-hero__title'>AI 农技助手</Text>
        <Text className='ai-hero__sub'>问答 · 病虫害诊断 · 节气建议</Text>
      </View>

      {/* === 对话流 === */}
      <ScrollView
        className='ai-thread'
        scrollY
        scrollTop={scrollTop}
        scrollWithAnimation
        enableBackToTop
      >
        {/* 空态 · 居中欢迎 + 推荐问题卡 */}
        {isEmpty && (
          <View className='ai-empty'>
            <View className='ai-empty__avatar'>
              <Text className='ai-empty__avatar-txt'>AI</Text>
            </View>
            <Text className='ai-empty__greet'>你好, {greetName}</Text>
            <Text className='ai-empty__hint'>我是陇上 AI 农技助手, 种植养护的问题都可以问我</Text>
            <View className='ai-empty__cards'>
              {HINTS.map((h) => (
                <View key={h} className='ai-empty__card' onClick={() => handleSend(h)}>
                  <Text className='ai-empty__card-text'>{h}</Text>
                  <Text className='ai-empty__card-arrow'>→</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {messages.map((m) => {
          if (m.kind === 'user') {
            return (
              <View key={m.id} className='msg msg--user'>
                <View className='msg__bubble msg__bubble--user'>
                  <Text className='msg__text'>{m.text}</Text>
                </View>
              </View>
            )
          }
          if (m.kind === 'system') {
            return (
              <View key={m.id} className='msg-sys'>
                <Text className='msg-sys__text'>{m.text}</Text>
              </View>
            )
          }
          if (m.kind === 'typing') {
            return (
              <View key={m.id} className='msg msg--ai'>
                <View className='msg__avatar'><Text className='msg__avatar-txt'>AI</Text></View>
                <View className='msg__bubble msg__bubble--ai msg__bubble--typing'>
                  <Text className='typing'>
                    <Text className='typing__dot typing__dot--1'>·</Text>
                    <Text className='typing__dot typing__dot--2'>·</Text>
                    <Text className='typing__dot typing__dot--3'>·</Text>
                  </Text>
                </View>
              </View>
            )
          }
          // AI 回复
          const fullReply = m.response.reply
          const replyChars = [...fullReply]
          const shownReply = m.done
            ? fullReply
            : replyChars.slice(0, m.typed).join('')
          // 仅当主文打完才渲染 suggestion + warning · 体验上和 chatgpt 一致
          // (主回复仍在打字时不要让"建议"提前露出)
          const showAux = m.done
          // 后端在 LLM 不可用时返回 intent='fallback_unavailable', 这里加视觉降级标记
          const isFallback = m.response.intent === 'fallback_unavailable'
          return (
            <View key={m.id} className={`msg msg--ai ${isFallback ? 'msg--fallback' : ''}`}>
              <View className='msg__avatar'><Text className='msg__avatar-txt'>AI</Text></View>
              <View className='msg__bubble msg__bubble--ai'>
                {showAux && m.response.intent && m.response.intent !== 'general_query' ? (
                  <View className={`msg__intent ${isFallback ? 'msg__intent--warn' : ''}`}>
                    <Text className='msg__intent-val'>
                      {INTENT_LABEL[m.response.intent] || m.response.intent}
                    </Text>
                  </View>
                ) : null}
                <Text className='msg__text'>
                  {shownReply}
                  {!m.done ? <Text className='msg__caret'>▍</Text> : null}
                </Text>
                {showAux && m.response.suggestion ? (
                  <View className='msg__suggest'>
                    <Text className='msg__suggest-val'>{m.response.suggestion}</Text>
                  </View>
                ) : null}
                {showAux && !m.response.permissionCheck ? (
                  <Text className='msg__warn'>· 该操作被安全系统拦截, 无法执行</Text>
                ) : null}
              </View>
            </View>
          )
        })}

        {/* 底部留白防最后一条被 input 遮 */}
        <View className='ai-thread__tail' />
      </ScrollView>

      {/* === 输入区 · 黏底 === */}
      <View className='ai-input'>
        <Input
          className='ai-input__field'
          value={input}
          placeholder='有问题尽管问我…'
          placeholderClass='ai-input__placeholder'
          maxlength={200}
          disabled={sending}
          onInput={(e: { detail: { value: string } }) => setInput(e.detail.value)}
          confirmType='send'
          onConfirm={() => handleSend()}
        />
        <Button
          className={`ai-input__send ${input.trim() && !sending ? 'ai-input__send--ready' : ''}`}
          disabled={sending || !input.trim()}
          onClick={() => handleSend()}
        >
          <Text className='ai-input__send-arrow'>{sending ? '…' : '↑'}</Text>
        </Button>
      </View>
    </View>
  )
}
