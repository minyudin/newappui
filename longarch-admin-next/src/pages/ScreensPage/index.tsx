import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import {
  Badge, Button, Card, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogSeal, DialogTitle, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui'
import { deleteScreen, listPlots, listScreens, regenerateScreenToken } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import RowLead from '@/components/table/RowLead'
import { toast } from '@/lib/toast'
import type { PageQuery, Screen } from '@/types/api'

/**
 * §9 Screens · 大屏管理
 * 对齐 longarch-admin/src/views/Screens.vue
 */

const ALL = '__all__'

/** bridge-viz 默认 dev 端口 · 跟 bridge-viz/vite.config.ts server.port 对齐 · 仅 dev 兜底用 */
const SCREEN_DEV_PORT = 5174

export default function ScreensPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<PageQuery & { plotId: string }>({
    pageNo: 1, pageSize: 10, plotId: '',
  })

  const [delDlg, setDelDlg] = useState<{ open: boolean; screen: Screen | null }>({
    open: false, screen: null,
  })
  const [deleting, setDeleting] = useState(false)

  const [tokenDlg, setTokenDlg] = useState<{ open: boolean; token: string; deviceNo: string; mode: 'view' | 'regen' }>({
    open: false, token: '', deviceNo: '', mode: 'view',
  })

  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.plotId) params.plotId = query.plotId
  const { data, isPending: loading } = useQuery({
    queryKey: qk.screens.list(params),
    queryFn: () => listScreens(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  // 下拉地块列表 · 配置型 (默认 staleTime)
  const plotsParams = { pageNo: 1, pageSize: 100 }
  const { data: plotsData } = useQuery({
    queryKey: qk.plots.list(plotsParams),
    queryFn: () => listPlots(plotsParams),
  })
  const plots = plotsData?.list ?? []

  async function handleDelete() {
    if (!delDlg.screen) return
    setDeleting(true)
    try {
      await deleteScreen(delDlg.screen.screenId)
      toast.success('大屏已删除')
      setDelDlg({ open: false, screen: null })
      queryClient.invalidateQueries({ queryKey: qk.screens.all() })
    } catch { /* interceptor */ } finally { setDeleting(false) }
  }

  async function handleRegenerate(s: Screen) {
    try {
      const res = await regenerateScreenToken(s.screenId)
      setTokenDlg({
        open: true,
        token: String(res?.screenToken ?? ''),
        deviceNo: String(s.deviceNo ?? ''),
        mode: 'regen',
      })
      queryClient.invalidateQueries({ queryKey: qk.screens.all() })
    } catch { /* interceptor */ }
  }

  function openTokenView(s: Screen) {
    setTokenDlg({
      open: true,
      token: String(s.screenToken ?? ''),
      deviceNo: String(s.deviceNo ?? ''),
      mode: 'view',
    })
  }

  function copyToken(t: string) {
    if (!t) {
      toast.warning('空 Token, 无可复制')
      return
    }
    navigator.clipboard.writeText(t)
      .then(() => toast.success('已复制 Token'))
      .catch(() => toast.warning('复制失败'))
  }

  /**
   * 生成激活链接: ${SCREEN_HOST}/?token=xxx&autosave=1
   *  · 主机优先级:
   *      1. import.meta.env.VITE_SCREEN_HOST   · 生产唯一来源, 必须是 bridge-viz 部署 host
   *      2. dev 兜底: 把当前 admin host 的端口替换为 bridge-viz 的 dev 端口 (5174)
   *  · 注意: 生产部署 admin-next 必须显式设置 VITE_SCREEN_HOST,
   *    否则会推断成 admin 自己的 host, 导致激活链接打开是 admin 不是大屏页.
   */
  function buildActivationUrl(token: string): string {
    const fromEnv = (import.meta.env.VITE_SCREEN_HOST as string | undefined) || ''
    if (fromEnv) {
      return `${fromEnv.replace(/\/$/, '')}/?token=${encodeURIComponent(token)}&autosave=1`
    }
    // dev 推断: bridge-viz 默认端口 5174 (vite.config.ts 中定义)
    const host = typeof window !== 'undefined'
      ? window.location.origin.replace(/:\d+$/, `:${SCREEN_DEV_PORT}`)
      : `http://localhost:${SCREEN_DEV_PORT}`
    return `${host}/?token=${encodeURIComponent(token)}&autosave=1`
  }

  function copyActivationUrl(t: string) {
    if (!t) {
      toast.warning('空 Token, 无激活链接')
      return
    }
    const url = buildActivationUrl(t)
    navigator.clipboard.writeText(url)
      .then(() => toast.success('已复制激活链接'))
      .catch(() => toast.warning('复制失败'))
  }

  return (
    <PageShell
      seal="§9 · Screens"
      title="Screens"
      titleCn="大 屏"
      lede="One row · one physical screen authorization · token grants farm-wide access."
      right={<><span>{total} ENTRIES</span><span>·</span><span>PAGE {String(query.pageNo).padStart(2, '0')}</span></>}
    >
      <section className="folio-page__section flex flex-wrap items-end gap-3" data-testid="screens-filter">
        <div className="flex flex-col gap-2">
          <Label htmlFor="screens-filter-plot">PLOT</Label>
          <Select
            value={query.plotId || ALL}
            onValueChange={(v) => setQuery((q) => ({ ...q, plotId: v === ALL ? '' : v, pageNo: 1 }))}
          >
            <SelectTrigger id="screens-filter-plot" className="w-[220px]"><SelectValue placeholder="All plots" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部 · All plots</SelectItem>
              {plots.map((p) => (
                <SelectItem key={p.plotId} value={String(p.plotId)}>
                  {String(p.plotName ?? p.name ?? p.plotId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="folio-page__section" data-testid="screens-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[130px]">Device No.</TableHead>
                <TableHead className="w-[160px]">Screen Name</TableHead>
                <TableHead className="w-[140px]" title="该屏开机默认大棚 · token 实际可看全农场">Plot · 默认</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[170px]">Last Ping</TableHead>
                <TableHead className="min-w-[220px]">Token</TableHead>
                <TableHead className="w-[180px]">Op.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s, idx) => {
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                const isOnline = String(s.status) === 'online'
                return (
                <TableRow key={s.screenId} className="row-fx">
                  <TableCell className="font-folio">
                    <RowLead seal={rowSeal} primary={String(s.screenId).padStart(3, '0')} />
                  </TableCell>
                  <TableCell className="font-folio text-[12px]">{String(s.deviceNo ?? '—')}</TableCell>
                  <TableCell>{String(s.screenName ?? '—')}</TableCell>
                  <TableCell className="text-[12px]">{String(s.plotName ?? '—')}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`row-fx__dot${isOnline ? ' row-fx__dot--breath' : ''}`}
                        data-tone={isOnline ? 'sage' : 'neutral'}
                      />
                      <Badge tone={isOnline ? 'sage' : 'neutral'}>
                        {String(s.status ?? '—')}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">{String(s.lastPingAt ?? '—')}</TableCell>
                  <TableCell
                    className="font-folio text-[11px] text-ink break-all cursor-pointer hover:text-sage"
                    onClick={() => openTokenView(s)}
                    data-testid={`screens-row-token-${s.screenId}`}
                    title="点击查看/复制 Token + 激活链接"
                  >
                    {String(s.screenToken ?? '—')}
                  </TableCell>
                  <TableCell className="flex flex-wrap gap-x-2 gap-y-1">
                    <Button
                      variant="link" size="sm"
                      onClick={() => copyToken(String(s.screenToken ?? ''))}
                      data-testid={`screens-row-copy-${s.screenId}`}
                    >复制</Button>
                    <Button
                      variant="link" size="sm"
                      onClick={() => copyActivationUrl(String(s.screenToken ?? ''))}
                      data-testid={`screens-row-link-${s.screenId}`}
                    >激活链接</Button>
                    <Button
                      variant="link" size="sm"
                      onClick={() => handleRegenerate(s)}
                      data-testid={`screens-row-regen-${s.screenId}`}
                    >重生</Button>
                    <Button
                      variant="link" size="sm"
                      className="text-clay hover:text-clay"
                      onClick={() => setDelDlg({ open: true, screen: s })}
                      data-testid={`screens-row-del-${s.screenId}`}
                    >删除</Button>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {list.length === 0 && !loading && <TableEmpty>No screens.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 10} total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>

      {/* Delete confirm */}
      <Dialog open={delDlg.open} onOpenChange={(open) => setDelDlg((d) => ({ ...d, open }))}>
        <DialogContent className="w-[min(420px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · delete</DialogSeal>
            <DialogTitle>确定删除该大屏?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[13px] text-ink">
              {String(delDlg.screen?.screenName ?? '')} · {String(delDlg.screen?.deviceNo ?? '')}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="danger" onClick={handleDelete} disabled={deleting} data-testid="screens-del-submit">
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token 查看 / 重生后展示 */}
      <Dialog open={tokenDlg.open} onOpenChange={(open) => setTokenDlg((d) => ({ ...d, open }))}>
        <DialogContent className="w-[min(640px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>
              § {tokenDlg.mode === 'regen' ? 'RESULT · new token' : 'VIEW · token'}
            </DialogSeal>
            <DialogTitle>
              {tokenDlg.mode === 'regen' ? 'Token 已重新生成' : '大屏 Token'}
              {tokenDlg.deviceNo ? <span className="ml-2 text-ink-faint font-folio text-[12px]">{tokenDlg.deviceNo}</span> : null}
            </DialogTitle>
            <DialogDescription>
              {tokenDlg.mode === 'regen'
                ? '旧 Token 已失效。请使用下方“复制激活链接”推送给现场运维, 大屏浏览器打开即自动设置。'
                : '复制 Token 到大屏激活页, 或使用激活链接一键设置。'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[11px] font-folio text-ink-faint tracking-widest mb-1">SCREEN TOKEN</div>
                <div className="font-folio text-[12px] text-ink break-all border border-line-soft px-3 py-2 bg-paper select-all">
                  {tokenDlg.token || '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-folio text-ink-faint tracking-widest mb-1">ACTIVATION URL</div>
                <div className="font-folio text-[12px] text-ink break-all border border-line-soft px-3 py-2 bg-paper select-all">
                  {tokenDlg.token ? buildActivationUrl(tokenDlg.token) : '—'}
                </div>
                <div className="mt-1 text-[10px] font-folio text-ink-faint tracking-widest">
                  大屏浏览器打开此链接 → 自动写入 localStorage · 之后免输入
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => copyToken(tokenDlg.token)} data-testid="screens-dlg-copy-token">复制 Token</Button>
            <Button variant="primary" onClick={() => copyActivationUrl(tokenDlg.token)} data-testid="screens-dlg-copy-link">复制激活链接</Button>
            <DialogClose asChild><Button variant="ghost">关闭</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
