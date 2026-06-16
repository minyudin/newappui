import './WizardStepper.scss'

/**
 * WizardStepper · 认养向导 4 步进度条
 * ============================================================
 *  设计意图:
 *   原来 Wizard 4 个 Card 上下铺开, 没顶栏进度提示, 操作员看不出
 *   "我处在第几步 / 还差多少". 这条 stepper 给出全局进度感:
 *
 *   §1 PLOT ──● §2 USER ──○ §3 TERM ──○ §4 CODE ──○ DONE
 *      地块      认养人     期限      认养码
 *
 *  状态:
 *   · done      · 已填好 (pointed)
 *   · active    · 当前步骤 (sage 主色 + 呼吸点)
 *   · pending   · 还没填
 *
 *  非控件: 只显示, 不响应点击 (Wizard 是顺序提交流, 不允许跳步)
 *  其实点击可以滚到对应 section, 用 anchor scroll
 * ============================================================ */

export interface WizardStep {
  seal: string       // §1
  cn: string         // 地块
  en: string         // PLOT
  /** 锚点 id (用于 click 滚动) */
  anchor: string
  /** 该步的当前完成度 · done | active | pending */
  state: 'done' | 'active' | 'pending'
}

interface Props {
  steps: WizardStep[]
}

export default function WizardStepper({ steps }: Props) {
  const doneCount = steps.filter((s) => s.state === 'done').length
  const total = steps.length
  const progressPct = Math.round((doneCount / total) * 100)

  function handleJump(anchor: string) {
    const node = document.getElementById(anchor)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="wiz-step">
      <div className="wiz-step__head">
        <span className="wiz-step__seal">§ PROGRESS · {doneCount}/{total} 完成</span>
        <span className="wiz-step__pct">{progressPct}%</span>
      </div>
      <div className="wiz-step__bar">
        <div className="wiz-step__bar-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <ol className="wiz-step__list">
        {steps.map((s, i) => (
          <li key={s.seal} className={`wiz-step__item wiz-step__item--${s.state}`}>
            <button
              type="button"
              className="wiz-step__item-btn"
              onClick={() => handleJump(s.anchor)}
              data-testid={`wiz-step-${s.anchor}`}
            >
              <span className="wiz-step__item-mark">
                {s.state === 'done' ? '√' : s.state === 'active' ? <span className="wiz-step__dot" /> : i + 1}
              </span>
              <div className="wiz-step__item-text">
                <span className="wiz-step__item-en">{s.seal} · {s.en}</span>
                <span className="wiz-step__item-cn">{s.cn}</span>
              </div>
            </button>
            {i < steps.length - 1 ? <span className="wiz-step__line" /> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}
