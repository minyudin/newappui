import PageShell from '@/components/shell/PageShell'

interface WipPageProps {
  seal: string
  title: string
  titleCn: string
  lede?: string
}

/**
 * WipPage · P3 通用占位
 * ============================================================
 *  P5 逐页移植时, 把 router/index.tsx 里对应的 <WipPage .../>
 *  替换成真正的页面组件即可
 * ============================================================ */
export default function WipPage({ seal, title, titleCn, lede }: WipPageProps) {
  return (
    <PageShell
      seal={seal}
      title={title}
      titleCn={titleCn}
      lede={lede ?? 'Chapter awaiting. Content will be ported here in P5.'}
      right={
        <>
          <span>WIP</span>
          <span>·</span>
          <span>P5 MIGRATION</span>
        </>
      }
    >
      <div className="folio-page__wip">
        P5 · TO BE MIGRATED FROM LONGARCH-ADMIN (VUE) TO REACT
      </div>
    </PageShell>
  )
}
