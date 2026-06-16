import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gsap } from 'gsap'
import PageShell from '@/components/shell/PageShell'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSeal,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { bindOperatorPlotScope, listOperatorPlotScopes, listPlots, listUsers, unbindOperatorPlotScope } from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import type { AdminUser, PageQuery, Plot } from '@/types/api'
import './OperatorScopesPage.scss'

type OperatorScopeRow = {
  bindingId?: number
  operatorUserId?: number
  plotId?: number
  isPrimary?: 0 | 1
  status?: string
}

function roleTone(r: string): 'plum' | 'fog' | 'moss' | 'sand' | 'neutral' {
  switch (r) {
    case 'operator': return 'fog'
    case 'admin': return 'plum'
    case 'agronomist': return 'moss'
    case 'adopter': return 'sand'
    default: return 'neutral'
  }
}

function plotLabel(p: Plot) {
  const anyP = p as unknown as { plotName?: unknown }
  return String(anyP.plotName ?? p.name ?? `#${p.plotId}`)
}

export default function OperatorScopesPage() {
  const queryClient = useQueryClient()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedCardRef = useRef<HTMLDivElement | null>(null)
  const bindButtonRef = useRef<HTMLButtonElement | null>(null)
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({})
  const [keyword, setKeyword] = useState('')
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null)
  const [bindDlgOpen, setBindDlgOpen] = useState(false)
  const [bindBusy, setBindBusy] = useState(false)
  const [bindPlotId, setBindPlotId] = useState<string>('')
  const [bindPrimary, setBindPrimary] = useState<'0' | '1'>('0')
  const [rowBusyPlotId, setRowBusyPlotId] = useState<number | null>(null)

  const operatorParams: PageQuery = useMemo(() => {
    const p: PageQuery = { pageNo: 1, pageSize: 100, roleType: 'operator' }
    if (keyword.trim()) p.keyword = keyword.trim()
    return p
  }, [keyword])

  const { data: operatorsData, isPending: loadingOperators } = useQuery({
    queryKey: qk.users.list(operatorParams),
    queryFn: () => listUsers(operatorParams),
  })
  const operators = (operatorsData?.list ?? []) as AdminUser[]

  const selectedOperator = operators.find((u) => u.userId === selectedOperatorId) ?? null

  const plotsAllParams = { pageNo: 1, pageSize: 200 }
  const { data: plotsAll } = useQuery({
    queryKey: qk.plots.list(plotsAllParams),
    queryFn: () => listPlots(plotsAllParams),
  })
  const plots = (plotsAll?.list ?? []) as Plot[]
  const plotMap = useMemo(() => new Map(plots.map((p) => [p.plotId, p])), [plots])

  const scopeParams = useMemo(() => ({ pageNo: 1, pageSize: 200 }), [])
  const { data: scopesData, isPending: loadingScopes } = useQuery({
    queryKey: selectedOperatorId ? qk.operatorScopes.list(selectedOperatorId, scopeParams) : ['operator-scopes', 'empty'],
    queryFn: () => listOperatorPlotScopes(String(selectedOperatorId), scopeParams),
    enabled: !!selectedOperatorId,
  })
  const scopes = (scopesData?.list ?? []) as OperatorScopeRow[]

  const scopedPlotIds = useMemo(() => new Set(scopes.map((s) => Number(s.plotId || 0)).filter(Boolean)), [scopes])

  function animateRowResult(plotId: number, tone: 'success' | 'error') {
    const row = rowRefs.current[plotId]
    if (!row) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (tone === 'success') {
      gsap.fromTo(
        row,
        {
          boxShadow: 'inset 0 0 0 0 rgba(111,138,118,0.0)',
          backgroundColor: 'rgba(111,138,118,0.0)',
        },
        {
          boxShadow: 'inset 0 0 0 999px rgba(111,138,118,0.12)',
          backgroundColor: 'rgba(111,138,118,0.08)',
          duration: 0.32,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        },
      )
      return
    }
    gsap.fromTo(
      row,
      { x: 0, backgroundColor: 'rgba(161,79,56,0.0)' },
      {
        x: 0,
        backgroundColor: 'rgba(161,79,56,0.08)',
        duration: 0.08,
        repeat: 3,
        yoyo: true,
        ease: 'power1.inOut',
      },
    )
    gsap.fromTo(
      row,
      { x: -3 },
      { x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: 'power1.inOut' },
    )
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.from('.op-scope-entrance', {
        y: 10,
        opacity: 0,
        duration: 0.45,
        ease: 'power2.out',
        stagger: 0.06,
      })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!selectedCardRef.current || !selectedOperatorId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(
      selectedCardRef.current,
      { boxShadow: '0 0 0 0 rgba(111,138,118,0.0)' },
      {
        boxShadow: '0 0 0 10px rgba(111,138,118,0)',
        duration: 0.5,
        ease: 'power2.out',
      },
    )
  }, [selectedOperatorId])

  useEffect(() => {
    if (!bindButtonRef.current || !selectedOperatorId) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = bindButtonRef.current
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8 })
    tl.to(el, { scale: 1.03, duration: 0.3, ease: 'power1.out' }).to(el, { scale: 1, duration: 0.4, ease: 'power1.inOut' })
    return () => {
      tl.kill()
    }
  }, [selectedOperatorId])

  async function doBind(isPrimary: 0 | 1) {
    if (!selectedOperatorId) {
      toast.warning('请先选择一个运营人员')
      return
    }
    const pid = Number(bindPlotId)
    if (!pid) {
      toast.warning('请选择地块')
      return
    }
    setBindBusy(true)
    try {
      await bindOperatorPlotScope(selectedOperatorId, pid, { isPrimary })
      toast.success(isPrimary === 1 ? '已绑定并设为主责' : '已绑定')
      setBindDlgOpen(false)
      setBindPlotId('')
      setBindPrimary('0')
      queryClient.invalidateQueries({ queryKey: qk.operatorScopes.all() })
    } finally {
      setBindBusy(false)
    }
  }

  async function doUnbind(plotId: number) {
    if (!selectedOperatorId) return
    setRowBusyPlotId(plotId)
    try {
      await unbindOperatorPlotScope(selectedOperatorId, plotId)
      toast.success('已解绑')
      animateRowResult(plotId, 'success')
      queryClient.invalidateQueries({ queryKey: qk.operatorScopes.all() })
    } catch {
      animateRowResult(plotId, 'error')
      toast.error('解绑失败，请重试')
    } finally {
      setRowBusyPlotId(null)
    }
  }

  async function doSetPrimary(plotId: number) {
    if (!selectedOperatorId) return
    setRowBusyPlotId(plotId)
    try {
      // 后端口径：对已存在绑定，bind + isPrimary=1 即为“主责切换”
      await bindOperatorPlotScope(selectedOperatorId, plotId, { isPrimary: 1 })
      toast.success('已设为主责')
      animateRowResult(plotId, 'success')
      queryClient.invalidateQueries({ queryKey: qk.operatorScopes.all() })
    } catch {
      animateRowResult(plotId, 'error')
      toast.error('设主责失败，请重试')
    } finally {
      setRowBusyPlotId(null)
    }
  }

  return (
    <div ref={rootRef}>
      <PageShell
        seal="§10C · Operator Scope"
        title="Operator Scope"
        titleCn="责 任 域 配 置"
        lede="Bind operators to plots. Define primary responsibility domain."
        right={
          <>
            <span>{selectedOperator ? `OPERATOR #${selectedOperator.userId}` : 'SELECT OPERATOR'}</span>
            <span>·</span>
            <span>{scopes.length} PLOTS</span>
          </>
        }
      >
        <section className="folio-page__section op-scope-entrance">
          <div className="op-scope-guide">
            <span className={`op-scope-guide__step ${selectedOperatorId ? 'is-done' : 'is-active'}`}>① 选择运营人员</span>
            <span className={`op-scope-guide__step ${selectedOperatorId ? 'is-active' : ''}`}>② 绑定地块责任域</span>
            <span className={`op-scope-guide__step ${selectedOperatorId && scopes.length > 0 ? 'is-active' : ''}`}>③ 设定主责与维护</span>
          </div>
        </section>
        <section className="folio-page__section grid grid-cols-1 gap-3 lg:grid-cols-[360px,1fr]">
        {/* Left: operator list */}
        <Card className="p-4 op-scope-entrance">
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="operator-scope-operator-search">OPERATOR</Label>
              <Input
                id="operator-scope-operator-search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="nickname / mobile / userNo"
              />
            </div>
          </div>

          <div className="mt-3 max-h-[540px] overflow-auto rounded-md border border-hairline">
            {operators.length === 0 && !loadingOperators ? (
              <div className="p-4 text-[12px] text-ink-faint">暂无 operator 用户</div>
            ) : null}
            {operators.map((u) => {
              const active = u.userId === selectedOperatorId
              return (
                <button
                  key={u.userId}
                  type="button"
                  className={`op-scope-operator-row w-full text-left px-3 py-2 border-b border-hairline last:border-b-0 ${
                    active ? 'is-active' : ''
                  }`}
                  onClick={() => setSelectedOperatorId(u.userId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[13px] text-ink leading-tight">{u.nickname ?? '—'}</span>
                      <span className="font-folio text-[10px] text-ink-faint leading-tight">
                        {u.userNo ? `U…${String(u.userNo).slice(-6)}` : `#${u.userId}`}
                      </span>
                    </div>
                    <Badge tone={roleTone(u.roleType)}>{u.roleType}</Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Right: scope table */}
        <Card ref={selectedCardRef} className="p-4 op-scope-entrance">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="font-folio text-[12px] text-ink-soft">SELECTED</div>
              <div className="text-[14px] text-ink">
                {selectedOperator ? `${selectedOperator.nickname ?? '—'} · #${selectedOperator.userId}` : '请选择左侧运营人员'}
              </div>
            </div>

            <Dialog open={bindDlgOpen} onOpenChange={setBindDlgOpen}>
              <DialogTrigger asChild>
                <Button ref={bindButtonRef} variant="primary" disabled={!selectedOperatorId}>
                  + 绑定地块
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(520px,calc(100vw-32px))]">
                <DialogHeader>
                  <DialogSeal>§ FORM · bind plot</DialogSeal>
                  <DialogTitle>绑定地块责任域</DialogTitle>
                  <DialogDescription>为该 operator 增加可处理的地块范围，并可指定主责。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="operator-scope-bind-plot">PLOT</Label>
                      <Select value={bindPlotId} onValueChange={setBindPlotId}>
                        <SelectTrigger id="operator-scope-bind-plot">
                          <SelectValue placeholder="选择地块" />
                        </SelectTrigger>
                        <SelectContent>
                          {plots.map((p) => (
                            <SelectItem
                              key={p.plotId}
                              value={String(p.plotId)}
                              disabled={scopedPlotIds.has(p.plotId)}
                            >
                              {plotLabel(p)} · #{p.plotId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-ink-faint">
                        已绑定的地块会被禁用选择。
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="operator-scope-bind-primary">PRIMARY</Label>
                      <Select value={bindPrimary} onValueChange={(v: '0' | '1') => setBindPrimary(v)}>
                        <SelectTrigger id="operator-scope-bind-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">否 · Backup</SelectItem>
                          <SelectItem value="1">是 · Primary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">取消</Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    onClick={() => doBind(bindPrimary === '1' ? 1 : 0)}
                    disabled={bindBusy}
                  >
                    {bindBusy ? '提交中…' : '确认绑定'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Plot</TableHead>
                  <TableHead className="w-[120px]">Primary</TableHead>
                  <TableHead className="w-[120px]">Ops</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopes.map((s) => {
                  const pid = Number(s.plotId || 0)
                  const p = plotMap.get(pid)
                  const busy = rowBusyPlotId === pid
                  const isPrimary = Number(s.isPrimary || 0) === 1
                  return (
                    <TableRow
                      key={`${s.operatorUserId}-${pid}-${s.bindingId ?? ''}`}
                      ref={(el) => {
                        rowRefs.current[pid] = el
                      }}
                    >
                      <TableCell className="text-[13px]">
                        <div className="flex flex-col">
                          <span className="text-ink leading-tight">{p ? plotLabel(p) : `#${pid}`}</span>
                          <span className="font-folio text-[10px] text-ink-faint leading-tight">PLOT #{pid}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone={isPrimary ? 'moss' : 'fog'}>{isPrimary ? '主责' : '备份'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || isPrimary}
                            onClick={() => doSetPrimary(pid)}
                          >
                            设主责
                          </Button>
                          <Button
                            size="sm"
                            variant="link"
                            disabled={busy}
                            onClick={() => doUnbind(pid)}
                          >
                            解绑
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {selectedOperatorId && scopes.length === 0 && !loadingScopes ? (
              <TableEmpty>该 operator 暂无绑定地块。</TableEmpty>
            ) : null}
            {!selectedOperatorId ? <TableEmpty>请选择左侧运营人员后查看责任域。</TableEmpty> : null}
          </div>
        </Card>
        </section>
      </PageShell>
    </div>
  )
}

