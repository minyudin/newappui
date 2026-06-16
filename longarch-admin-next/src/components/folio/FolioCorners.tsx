import './FolioCorners.scss'

/**
 * FolioCorners · 4 角规矩线
 * ============================================================
 *  Folio 学术志风格的"版心校对标记": 4 个角各 12×12 的直角短线.
 *  纯装饰, pointer-events: none, 不影响交互.
 *
 *  设计意图:
 *   · 在登录页 / 首页等"封面态"页面四角加规矩线, 让屏幕看起来像
 *     一张校样纸 (印刷打样的版心标记)
 *   · 与 PageQuote / 章节印章 / hairline 表格构成同一套视觉语言
 *
 *  实现:
 *   · 一个绝对定位的容器, 内含 4 个角短线 (CSS 端用伪元素或 4 个 div)
 *   · z-index 较低, 不抢动效层
 *
 *  与 miniapp 同名组件保持视觉一致, 仅 View → div / className 不变
 * ============================================================ */
export default function FolioCorners() {
  return (
    <div className='folio-corners' aria-hidden='true'>
      <div className='folio-corners__c folio-corners__c--tl' />
      <div className='folio-corners__c folio-corners__c--tr' />
      <div className='folio-corners__c folio-corners__c--bl' />
      <div className='folio-corners__c folio-corners__c--br' />
    </div>
  )
}
