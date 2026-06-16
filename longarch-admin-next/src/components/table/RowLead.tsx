import type { ReactNode } from 'react'

/**
 * RowLead · 表格第一格通用组件
 * ============================================================
 *  统一处理: §NN 行索引印章 + 主标 + 副标 (二选一或两者都有)
 *
 *  实现:
 *   · 用 grid (auto 1fr) 把印章和正文分两列, 不依赖 absolute / padding hack
 *   · 副标可空 (单行模式)
 *   · 印章可空 (无印章只两行 cell)
 *
 *  使用:
 *    <TableCell>
 *      <RowLead seal="§01" primary="20066" />            // 单行
 *      <RowLead seal="§01" primary="示范运营员" secondary="U.280576" />  // 双行
 *      <RowLead primary="..." secondary="..." />          // 无印章
 *    </TableCell>
 *
 *  样式钩子在 styles/table-row-fx.scss 里 (.row-fx__lead 系列)
 * ============================================================ */

interface Props {
  /** §NN 行索引印章 · 可空 */
  seal?: string
  /** 主标 · 必须 */
  primary: ReactNode
  /** 副标 · 可空 (单行模式自动收起) */
  secondary?: ReactNode
  /** primary 的 title 属性 (鼠标悬停显示完整文本, 给 truncate 兜底) */
  title?: string
}

export default function RowLead({ seal, primary, secondary, title }: Props) {
  return (
    <div className="row-fx__lead">
      {seal ? <span className="row-fx__lead-seal">{seal}</span> : <span />}
      <div className="row-fx__lead-body">
        <span className="row-fx__primary" title={title}>
          {primary}
        </span>
        {secondary !== undefined && secondary !== null && secondary !== '' ? (
          <span className="row-fx__secondary">{secondary}</span>
        ) : null}
      </div>
    </div>
  )
}
