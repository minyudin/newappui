import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { gsap } from 'gsap'
import { useAuthStore } from '@/stores/auth'
import { adminLogin, fetchPlatformConfig } from '@/api'
import { qk } from '@/lib/queryKeys'
import { STALE } from '@/lib/queryClient'
import { toast } from '@/lib/toast'
import { useGsapButton } from '@/lib/useGsapButton'
import { getCurrentPentad } from '@/lib/solarTerm'
import FolioCorners from '@/components/folio/FolioCorners'
import Marquee from '@/components/folio/Marquee'
import './LoginPage.scss'

/**
 * §0 LoginPage · GSAP 编辑刊物版 (2026-05 第 4 稿)
 * ============================================================
 *  此前问题:
 *   1. 输入要点一下 → 输入框看不出"是个输入框", 也没 autofocus
 *   2. 不像登录页 → 主标"管理员登录"被淹没, 没有清晰的入口提示
 *
 *  本稿改造:
 *   A. 顶部加一道"主入口横幅" SIGN IN · 管理员登录 · ADMIN ENTRY (中英编号)
 *      用 GSAP 时间线进场, 字符级 stagger reveal, 一眼识别这是登录页
 *   B. 输入框换成"键盘式"卡片: 浅纸底 + 边框 + 大字 + 隐式聚焦动画 (label 上浮)
 *      + 表单挂载时自动 focus 第一行 (mobile)
 *   C. 全页用 GSAP timeline 编排进场:
 *      hairline → 标题章 → 节气印章 → 时钟 → LONGARCH 字符级揭开 → 引文 →
 *      目录条 01 / 02 → SIGN IN 大按钮
 *   D. SIGN IN 按钮在 hover 时 GSAP 推开下一个组件呼吸
 *   E. 错误抖动 (shake) 用 gsap.to 实现
 *
 *  保留: 鼠标光斑 / 4 角规矩线 / 中空字 hover / 闪烁光标 / 跑马字
 * ============================================================ */

const MOBILE_RE = /^1[3-9]\d{9}$/

const LIVRE_QUOTES: string[] = [
  '§ FOLIO · No.07',
  '陇上认养',
  'SMART AGRICULTURE',
  '稼穑之事 · 半在农时 半在器具',
  'EST. 2026',
  'OPS · BACKSTAGE',
  '凡农之道 · 厚之为宝',
  'VOL.II / EDITION 07',
]

export default function LoginPage() {
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const submitRef = useRef<HTMLButtonElement | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const mobileInputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const displayRef = useRef<HTMLHeadingElement | null>(null)

  const setUserInfo = useAuthStore((s) => s.setUserInfo)
  const clearStore = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const { data: cfg } = useQuery({
    queryKey: qk.platformConfig(),
    queryFn: fetchPlatformConfig,
    staleTime: STALE.STATIC,
    retry: false,
  })
  const platformName = cfg?.platformName ?? ''
  useGsapButton(submitRef, { disabled: submitting })

  const pentad = useMemo(() => getCurrentPentad(), [])
  const pentadSeasonChar = pentad.term.name.charAt(0)

  // 实时秒钟
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const dateStr = useMemo(() => {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}.${m}.${d}`
  }, [now])

  // 鼠标光斑
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let lastX = 50
    let lastY = 50
    function onMove(e: MouseEvent) {
      if (!stage) return
      const r = stage.getBoundingClientRect()
      lastX = ((e.clientX - r.left) / r.width) * 100
      lastY = ((e.clientY - r.top) / r.height) * 100
      if (!raf) {
        raf = requestAnimationFrame(() => {
          stage!.style.setProperty('--mouseX', `${lastX}%`)
          stage!.style.setProperty('--mouseY', `${lastY}%`)
          raf = 0
        })
      }
    }
    function onLeave() {
      stage!.style.setProperty('--mouseX', '50%')
      stage!.style.setProperty('--mouseY', '50%')
    }
    stage.addEventListener('mousemove', onMove)
    stage.addEventListener('mouseleave', onLeave)
    return () => {
      stage.removeEventListener('mousemove', onMove)
      stage.removeEventListener('mouseleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // GSAP 主进场 timeline · 编排所有进场
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stage = stageRef.current
    if (!stage) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      // §1 顶部刊号条 + Hero 标题章 (主入口提示)
      tl.from('[data-gsap="bar"]', { y: -12, opacity: 0, duration: 0.5 }, 0)
        .from('[data-gsap="banner"]', {
          y: 24,
          opacity: 0,
          duration: 0.7,
        }, 0.1)
        .from('[data-gsap="banner-char"]', {
          y: 30,
          opacity: 0,
          duration: 0.5,
          stagger: 0.025,
        }, 0.2)

      // §2 时钟 + 印章 同时进场
      tl.from('[data-gsap="clock"]', { y: 16, opacity: 0, duration: 0.6 }, 0.45)
        .from('[data-gsap="stamp"]', {
          y: -16,
          opacity: 0,
          rotation: -10,
          scale: 0.92,
          duration: 0.7,
          ease: 'back.out(1.4)',
        }, 0.45)

      // §3 LONGARCH 字符级 stagger reveal
      const display = displayRef.current
      if (display) {
        // 把 LONG / ARCH 内每个字母 wrap 成 span (静态文本不变, 只动新建 span)
        const solid = display.querySelector('[data-gsap="display-solid"]')
        const hollow = display.querySelector('[data-gsap="display-hollow"]')
        ;[solid, hollow].forEach((node) => {
          if (!node || node.querySelector('.l-char')) return
          const text = node.textContent ?? ''
          node.textContent = ''
          for (const ch of text) {
            const span = document.createElement('span')
            span.className = 'l-char'
            span.textContent = ch
            ;(node as HTMLElement).appendChild(span)
          }
        })
        tl.from('.l-char', {
          y: 80,
          opacity: 0,
          rotateX: -65,
          duration: 0.7,
          stagger: 0.04,
          ease: 'power3.out',
        }, 0.6)
      }

      // §4 引文 hairline 由内向外展开 + 引文淡入
      tl.from('[data-gsap="rule"] .login-stage__rule-line', {
        scaleX: 0,
        transformOrigin: 'center center',
        duration: 0.8,
        ease: 'power3.inOut',
      }, 1.1)
        .from('[data-gsap="rule-quote"]', {
          y: 6,
          opacity: 0,
          duration: 0.5,
        }, 1.4)

      // §5 表单 · 目录条 01/02/submit 逐行 reveal
      tl.from('[data-gsap="form-row"]', {
        y: 18,
        opacity: 0,
        duration: 0.55,
        stagger: 0.12,
      }, 1.55)

      // §6 跑马字 + 4 角线收尾
      tl.from('[data-gsap="marquee"]', { opacity: 0, duration: 0.5 }, 2.0)

      // §7 表单首行自动聚焦, 进场动画结束后再 focus 避免动画里抖
      tl.call(() => {
        // 不滚动到视图, 用 preventScroll 避免大字溢出导致页面跳
        try {
          mobileInputRef.current?.focus({ preventScroll: true })
        } catch {
          mobileInputRef.current?.focus()
        }
      }, undefined, 2.0)
    }, stage)

    return () => ctx.revert()
  }, [])

  // GSAP shake · 错误时左右抖动 + 砖红闪
  useEffect(() => {
    if (!errMsg) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const form = formRef.current
    if (!form) return
    gsap.fromTo(
      form,
      { x: 0 },
      {
        x: 0,
        keyframes: [
          { x: -8 },
          { x: 8 },
          { x: -6 },
          { x: 6 },
          { x: 0 },
        ],
        duration: 0.45,
        ease: 'power2.inOut',
      },
    )
  }, [errMsg])

  function validate(): string | null {
    if (!mobile) return '请填写手机号'
    if (!MOBILE_RE.test(mobile)) return '手机号格式不正确'
    if (!password) return '请填写密码'
    if (password.length < 6) return '密码长度至少 6 位'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const err = validate()
    if (err) {
      setErrMsg(err)
      return
    }
    setErrMsg(null)
    setSubmitting(true)
    try {
      const data = await adminLogin({ mobile, password })
      if (data.userInfo?.roleType !== 'admin') {
        clearStore()
        setErrMsg('此账号无管理后台权限')
        toast.error('此账号无管理后台权限')
        return
      }
      setUserInfo(data.userInfo)
      toast.success(`已登录 · ${data.userInfo?.nickname || mobile}`)
      // 出场动画: 整页向上滑出
      const stage = stageRef.current
      if (stage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.to(stage, {
          y: -20,
          opacity: 0,
          duration: 0.4,
          ease: 'power3.in',
          onComplete: () => navigate('/dashboard'),
        })
      } else {
        navigate('/dashboard')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败'
      setErrMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // 主标横幅"SIGN IN · 管理员登录 · ADMIN ENTRY"
  // 拆字符让 GSAP stagger 接管
  const bannerChars = '管理员登录 · ADMIN ENTRY'.split('')

  return (
    <main
      ref={stageRef}
      className={`login-stage login-stage--season-${pentad.term.season}`}
    >
      <FolioCorners />

      {/* §1 · 顶部刊号条 */}
      <div className="login-stage__top" data-gsap="bar">
        <span className="login-stage__masthead">§ FOLIO · VOL.II / No.07</span>
        <span className="login-stage__crossbar" />
        <span className="login-stage__pentad-bar">
          〈 <strong>{pentad.term.name}</strong> · 第 {pentad.index} 候 · <em>{pentad.name}</em> 〉
        </span>
      </div>

      {/* §1.5 · 主入口横幅 (新增 · 让人一眼知道这是登录页) */}
      <div className="login-stage__banner" data-gsap="banner">
        <span className="login-stage__banner-arrow">↘</span>
        <span className="login-stage__banner-seal">§ ADMIN ENTRY · 管理员登录入口</span>
        <span className="login-stage__banner-bar" />
        <h1 className="login-stage__banner-title" aria-label="管理员登录 · ADMIN ENTRY">
          {bannerChars.map((ch, i) => (
            <span key={i} className="login-stage__banner-char" data-gsap="banner-char">
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </h1>
        <span className="login-stage__banner-meta">SIGN IN BELOW · 02 STEPS</span>
      </div>

      {/* §2 · Hero · 12 列 grid */}
      <section className="login-stage__hero">
        {/* 时钟 */}
        <div className="login-stage__clock" data-gsap="clock">
          <span className="login-stage__clock-label">LIVE</span>
          <span className="login-stage__clock-time">
            <span className="login-stage__clock-num">{hh}</span>
            <span className="login-stage__clock-sep">:</span>
            <span className="login-stage__clock-num">{mm}</span>
            <span className="login-stage__clock-sec">:{ss}</span>
          </span>
          <span className="login-stage__clock-date">{dateStr} · {platformName || '陇上 · OPS'}</span>
        </div>

        {/* 节气印章 */}
        <div className="login-stage__pentad-stamp" data-gsap="stamp">
          <span className="login-stage__pentad-stamp-char" aria-hidden="true">
            {pentadSeasonChar}
          </span>
          <div className="login-stage__pentad-stamp-meta">
            <span className="login-stage__pentad-stamp-key">§ TERM · {pentad.index}/3</span>
            <span className="login-stage__pentad-stamp-name">{pentad.term.name}</span>
            <span className="login-stage__pentad-stamp-pent">{pentad.name}</span>
            <span className="login-stage__pentad-stamp-saying">{pentad.term.saying}</span>
          </div>
        </div>

        {/* LONGARCH 巨字 · GSAP 字符级 reveal */}
        <h2 ref={displayRef} className="login-stage__display">
          <span className="login-stage__display-solid" data-gsap="display-solid">LONG</span>
          <span className="login-stage__caret" aria-hidden="true" />
          <span className="login-stage__display-hollow" data-gsap="display-hollow">ARCH</span>
        </h2>

        {/* 引文 hairline */}
        <div className="login-stage__rule" data-gsap="rule">
          <span className="login-stage__rule-line" />
          <span className="login-stage__rule-quote" data-gsap="rule-quote">
            <span className="login-stage__rule-cn">凡稼穑之事 · 半在农时 · 半在器具</span>
            <span className="login-stage__rule-en"><em>The art of farming, half in season, half in tools.</em></span>
          </span>
          <span className="login-stage__rule-line" />
        </div>

        {/* 表单 · 目录条 */}
        <form ref={formRef} className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form__row" data-gsap="form-row">
            <span className="login-form__row-num">01</span>
            <label className="login-form__row-label" htmlFor="login-mobile">
              MOBILE <em>· 手机号</em>
            </label>
            <span className="login-form__row-rule" />
            <div className="login-form__row-input-wrap">
              <input
                id="login-mobile"
                ref={mobileInputRef}
                type="tel"
                autoComplete="username"
                inputMode="numeric"
                maxLength={11}
                className="login-form__row-input"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/\D/g, ''))
                  if (errMsg) setErrMsg(null)
                }}
                placeholder="1XX XXXX XXXX"
                data-testid="login-mobile"
                disabled={submitting}
              />
              <span className="login-form__row-input-underline" />
            </div>
          </div>

          <div className="login-form__row" data-gsap="form-row">
            <span className="login-form__row-num">02</span>
            <label className="login-form__row-label" htmlFor="login-password">
              PASSWORD <em>· 密码</em>
            </label>
            <span className="login-form__row-rule" />
            <div className="login-form__row-input-wrap">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className="login-form__row-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errMsg) setErrMsg(null)
                }}
                placeholder="··········"
                data-testid="login-password"
                disabled={submitting}
              />
              <span className="login-form__row-input-underline" />
            </div>
          </div>

          {errMsg && (
            <p className="login-form__err" data-testid="login-err">
              <em className="login-form__err-dot" />
              <span>{errMsg}</span>
            </p>
          )}

          <div className="login-form__bottom" data-gsap="form-row">
            <span className="login-form__hint">§ 失败 5 次锁 15 分钟 · ADMIN ONLY</span>
            <button
              ref={submitRef}
              type="submit"
              className={`login-form__submit ${submitting ? 'login-form__submit--busy' : ''}`}
              disabled={submitting}
              data-testid="login-submit"
            >
              <span className="login-form__submit-num">→</span>
              <span className="login-form__submit-label">
                {submitting ? 'SIGNING IN' : 'SIGN IN'}
              </span>
              <span className="login-form__submit-cn">
                {submitting ? '登录中' : '进入后台'}
              </span>
              <span className="login-form__submit-bar" />
            </button>
          </div>
        </form>
      </section>

      {/* §3 · 底部跑马字 */}
      <footer className="login-stage__marquee" data-gsap="marquee">
        <Marquee items={LIVRE_QUOTES} speed={50} ruled tone="default" />
      </footer>
    </main>
  )
}
