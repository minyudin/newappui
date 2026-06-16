import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import { OrderSelect } from '@/components/selects'
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
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { createCode, getCodeDetail, listCodes, listDevices, revokeCode } from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import RowLead from '@/components/table/RowLead'
import type { AdoptionCode, AdoptionOrder, PageQuery } from '@/types/api'

/**
 * §4 Codes · 认养码
 * ============================================================
 *  对齐 longarch-admin/src/views/Codes.vue
 *  · 筛选: status (active/used/revoked)
 *  · 生成: orderId + codeType + validFrom + validTo
 *  · 吊销: 带二次确认 Dialog
 * ============================================================ */

const STATUS_OPTIONS = [
  { value: 'active',   cn: '激活',   tone: 'sage'    as const },
  { value: 'used',     cn: '已使用', tone: 'neutral' as const },
  { value: 'revoked',  cn: '已吊销', tone: 'clay'    as const },
]

const CODE_TYPE_OPTIONS = [
  { value: 'master', cn: '主码 · master' },
  { value: 'guest',  cn: '访客码 · guest' },
  { value: 'share',  cn: '分享码 · share' },
]

const ALL = '__all__'

function statusMeta(s?: string) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { value: s ?? '—', cn: s ?? '—', tone: 'neutral' as const }
}

interface CreateForm {
  orderId: string
  codeType: string
  validFrom: string
  validTo: string
  dailyAccessStart: string
  dailyAccessEnd: string
  canViewLive: boolean
  canViewHistory: boolean
  canViewSensor: boolean
  canOperate: boolean
  maxDailyOperations: string
  shareable: boolean
  allowIrrigation: boolean
  allowFertilize: boolean
  allowSpray: boolean
}

const EMPTY_CREATE: CreateForm = {
  orderId: '',
  codeType: 'master',
  validFrom: '',
  validTo: '',
  dailyAccessStart: '08:00:00',
  dailyAccessEnd: '22:00:00',
  canViewLive: true,
  canViewHistory: true,
  canViewSensor: true,
  canOperate: true,
  maxDailyOperations: '3',
  shareable: false,
  allowIrrigation: true,
  allowFertilize: true,
  allowSpray: true,
}

const ACTION_CAPS = [
  { key: 'allowIrrigation' as const, actionType: 'irrigation_apply', label: '浇水 · irrigation' },
  { key: 'allowFertilize' as const, actionType: 'fertilize_apply', label: '施肥 · fertilize' },
  { key: 'allowSpray' as const, actionType: 'spray_apply', label: '喷淋 · spray' },
] as const

const DEVICE_CAPS = [
  { types: ['fertigation_machine', 'irrigator'], label: '浇水能力设备 · fertigation_machine' },
  { types: ['fertigation_machine', 'fertilizer'], label: '施肥能力设备 · fertigation_machine' },
  { types: ['wet_curtain_controller', 'sprayer', 'fertigation_machine'], label: '喷淋能力设备 · wet_curtain_controller' },
] as const

export default function CodesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState<PageQuery & { status: string }>({
    pageNo: 1, pageSize: 10, status: '',
  })
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  // Trigger 上展示订单人读名字需要完整实体
  const [selectedOrder, setSelectedOrder] = useState<AdoptionOrder | null>(null)
  const selectedPlotId = Number(selectedOrder?.plotId ?? 0)
  const devicesParams = useMemo(
    () => ({ pageNo: 1, pageSize: 200, plotId: selectedPlotId }),
    [selectedPlotId],
  )
  const { data: plotDevicesData } = useQuery({
    queryKey: qk.devices.list(devicesParams),
    queryFn: () => listDevices(devicesParams),
    enabled: showCreate && selectedPlotId > 0,
  })
  const deviceTypes = useMemo(
    () =>
      new Set(
        (plotDevicesData?.list ?? [])
          .filter((d) => {
            const st = String(d.deviceStatus ?? '').toLowerCase()
            return st === '' || st === 'online' || st === 'idle' || st === 'running'
          })
          .map((d) => String(d.deviceType ?? '').toLowerCase()),
      ),
    [plotDevicesData],
  )

  // §跨页联动·URL 预填一次性消费 (OrdersPage 点「生成认养码」跳过来)
  //   ?prefillOrderId=456&prefillOrderNo=ORD-XXX&openCreate=1
  const prefillConsumedRef = useRef(false)
  useEffect(() => {
    if (prefillConsumedRef.current) return
    const pOrderId = searchParams.get('prefillOrderId')
    const pOrderNo = searchParams.get('prefillOrderNo')
    const pOpen = searchParams.get('openCreate') === '1'
    if (!pOrderId && !pOpen) return
    prefillConsumedRef.current = true
    if (pOrderId) {
      setCreateForm((f) => ({ ...f, orderId: pOrderId }))
      setSelectedOrder({
        orderId: Number(pOrderId),
        orderNo: pOrderNo || undefined,
        orderStatus: '',
      } as AdoptionOrder)
    }
    if (pOpen) setShowCreate(true)
    const next = new URLSearchParams(searchParams)
    ;['prefillOrderId', 'prefillOrderNo', 'openCreate'].forEach((k) => next.delete(k))
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
  const [revokeDlg, setRevokeDlg] = useState<{ open: boolean; code: AdoptionCode | null }>({
    open: false, code: null,
  })
  const [revoking, setRevoking] = useState(false)

  // 详情抽屉 · 先放 row snapshot, 再异步 GET /admin/adoption-codes/{id} 补齐完整权限矩阵
  const [detailDlg, setDetailDlg] = useState<{
    open: boolean
    code: AdoptionCode | null
    loading: boolean
  }>({ open: false, code: null, loading: false })

  async function openDetail(row: AdoptionCode) {
    setDetailDlg({ open: true, code: row, loading: true })
    try {
      const fresh = await getCodeDetail(row.codeId)
      setDetailDlg({ open: true, code: { ...row, ...fresh }, loading: false })
    } catch {
      // 拦截器已 toast
      setDetailDlg((prev) => ({ ...prev, loading: false }))
    }
  }

  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.status) params.status = query.status
  const {
    data,
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.codes.list(params),
    queryFn: () => listCodes(params),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  async function handleCreate() {
    if (!createForm.orderId || !createForm.validFrom || !createForm.validTo) {
      toast.warning('orderId / validFrom / validTo 均为必填')
      return
    }
    if (createForm.canOperate && !ACTION_CAPS.some((a) => createForm[a.key])) {
      toast.warning('已开启可操作时，至少勾选一个动作白名单')
      return
    }
    setCreating(true)
    try {
      await createCode({
        orderId: Number(createForm.orderId),
        codeType: createForm.codeType,
        validFrom: createForm.validFrom.replace('T', ' ') + ':00',
        validTo: createForm.validTo.replace('T', ' ') + ':00',
        dailyAccessStart: createForm.dailyAccessStart,
        dailyAccessEnd: createForm.dailyAccessEnd,
        permissions: {
          canViewLive: createForm.canViewLive,
          canViewHistory: createForm.canViewHistory,
          canViewSensor: createForm.canViewSensor,
          canOperate: createForm.canOperate,
          maxDailyOperations: Number(createForm.maxDailyOperations || '0') || 0,
          shareable: createForm.shareable,
          operationWhitelist: ACTION_CAPS.filter((a) => createForm[a.key]).map((a) => a.actionType),
        },
      })
      toast.success('认养码已生成')
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      setSelectedOrder(null)
      setQuery((q) => ({ ...q, pageNo: 1 }))
      queryClient.invalidateQueries({ queryKey: qk.codes.all() })
    } catch {
      /* interceptor */
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!revokeDlg.code) return
    setRevoking(true)
    try {
      await revokeCode(revokeDlg.code.codeId, { reason: '管理员手动吊销' })
      toast.success('已吊销')
      setRevokeDlg({ open: false, code: null })
      queryClient.invalidateQueries({ queryKey: qk.codes.all() })
    } catch {
      /* interceptor */
    } finally {
      setRevoking(false)
    }
  }

  return (
    <PageShell
      seal="§4 · Codes"
      title="Adoption Codes"
      titleCn="认 养 码"
      lede="Printable keys. One order, many invitations."
      right={
        <>
          <span>{total} ENTRIES</span>
          <span>·</span>
          <span>PAGE {String(query.pageNo).padStart(2, '0')}</span>
        </>
      }
    >
      {/* Filter + Create */}
      <section
        className="folio-page__section flex !flex-row flex-wrap items-end justify-between gap-3"
        data-testid="codes-filter"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="codes-filter-status">STATUS</Label>
            <Select
              value={query.status || ALL}
              onValueChange={(v) =>
                setQuery((q) => ({ ...q, status: v === ALL ? '' : v, pageNo: 1 }))
              }
            >
              <SelectTrigger id="codes-filter-status" className="w-[180px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部 · All</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.cn} · {s.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button variant="primary" data-testid="codes-create-trigger">+ 生成认养码</Button>
          </DialogTrigger>
          <DialogContent className="w-[min(480px,calc(100vw-32px))]">
            <DialogHeader>
              <DialogSeal>§ FORM · new code</DialogSeal>
              <DialogTitle>生成认养码</DialogTitle>
              <DialogDescription>Mint a key for an existing order.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code-order-id">ORDER *</Label>
                  <OrderSelect
                    id="code-order-id"
                    value={createForm.orderId}
                    selectedItem={selectedOrder}
                    onChange={(v, item) => {
                      setCreateForm((f) => ({ ...f, orderId: v }))
                      setSelectedOrder(item)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code-type">TYPE</Label>
                  <Select
                    value={createForm.codeType}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, codeType: v }))}
                  >
                    <SelectTrigger id="code-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CODE_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.cn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code-valid-from">VALID FROM *</Label>
                    <Input id="code-valid-from" type="datetime-local" value={createForm.validFrom}
                      onChange={(e) => setCreateForm((f) => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code-valid-to">VALID TO *</Label>
                    <Input id="code-valid-to" type="datetime-local" value={createForm.validTo}
                      onChange={(e) => setCreateForm((f) => ({ ...f, validTo: e.target.value }))} />
                  </div>
                </div>
                <div className="rounded-md border border-line-soft bg-paper-light p-3 flex flex-col gap-2">
                  <div className="font-folio text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                    § CAPABILITY · 设备能力预览
                  </div>
                  {selectedPlotId > 0 ? (
                    <div className="grid grid-cols-1 gap-1.5">
                      {DEVICE_CAPS.map((cap) => {
                        const ok = cap.types.some((t) => deviceTypes.has(t))
                        return (
                          <div key={cap.label} className="flex items-center justify-between text-[12px]">
                            <span className="text-ink-soft">{cap.label}</span>
                            <Badge tone={ok ? 'sage' : 'clay'}>{ok ? '已就绪' : '缺失'}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-[12px] text-ink-faint">先选择订单后显示地块设备能力</span>
                  )}
                </div>
                <div className="rounded-md border border-line-soft p-3 flex flex-col gap-3">
                  <div className="font-folio text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                    § PERMISSION · 小程序权限下发
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={createForm.canViewLive}
                        onChange={(e) => setCreateForm((f) => ({ ...f, canViewLive: e.target.checked }))}
                      />
                      允许看直播
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={createForm.canViewHistory}
                        onChange={(e) => setCreateForm((f) => ({ ...f, canViewHistory: e.target.checked }))}
                      />
                      允许看历史
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={createForm.canViewSensor}
                        onChange={(e) => setCreateForm((f) => ({ ...f, canViewSensor: e.target.checked }))}
                      />
                      允许看传感器
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={createForm.canOperate}
                        onChange={(e) => setCreateForm((f) => ({ ...f, canOperate: e.target.checked }))}
                      />
                      允许操作
                    </label>
                    <label className="flex items-center gap-2 text-[12px] text-ink">
                      <input
                        type="checkbox"
                        checked={createForm.shareable}
                        onChange={(e) => setCreateForm((f) => ({ ...f, shareable: e.target.checked }))}
                      />
                      允许分享
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="code-daily-start">操作开始</Label>
                      <Input
                        id="code-daily-start"
                        type="time"
                        step={1}
                        value={createForm.dailyAccessStart.slice(0, 8)}
                        onChange={(e) => setCreateForm((f) => ({ ...f, dailyAccessStart: `${e.target.value}:00`.slice(0, 8) }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="code-daily-end">操作结束</Label>
                      <Input
                        id="code-daily-end"
                        type="time"
                        step={1}
                        value={createForm.dailyAccessEnd.slice(0, 8)}
                        onChange={(e) => setCreateForm((f) => ({ ...f, dailyAccessEnd: `${e.target.value}:00`.slice(0, 8) }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="code-max-daily">每日操作上限</Label>
                      <Input
                        id="code-max-daily"
                        type="number"
                        min={0}
                        value={createForm.maxDailyOperations}
                        onChange={(e) => setCreateForm((f) => ({ ...f, maxDailyOperations: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>可操作动作白名单</Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {ACTION_CAPS.map((a) => (
                        <label key={a.actionType} className="flex items-center gap-2 text-[12px] text-ink">
                          <input
                            type="checkbox"
                            checked={createForm[a.key]}
                            onChange={(e) => setCreateForm((f) => ({ ...f, [a.key]: e.target.checked }))}
                          />
                          {a.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
              <Button variant="primary" onClick={handleCreate} disabled={creating} data-testid="codes-create-submit">
                {creating ? '提交中...' : '提交'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Table */}
      <section className="folio-page__section" data-testid="codes-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[220px]">Code</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[160px]">Created</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c, idx) => {
                const meta = statusMeta(String(c.status ?? ''))
                const revoked = c.status === 'revoked'
                const breath = c.status === 'active' || c.status === 'pending'
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                return (
                  <TableRow key={c.codeId} className="row-fx">
                    <TableCell className="font-folio">
                      <RowLead seal={rowSeal} primary={String(c.codeId).padStart(3, '0')} />
                    </TableCell>
                    <TableCell className="font-folio text-[12px]">{String(c.code ?? '—')}</TableCell>
                    <TableCell className="font-folio text-[12px]">{String(c.codeType ?? '—')}</TableCell>
                    <TableCell className="font-folio">{String(c.orderId ?? '—')}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`row-fx__dot${breath ? ' row-fx__dot--breath' : ''}`} data-tone={meta.tone} />
                        <Badge tone={meta.tone}>{meta.cn}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="font-folio text-[11px] text-ink-soft">{String(c.createdAt ?? '—')}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => openDetail(c)}
                          data-testid={`codes-row-detail-${c.codeId}`}
                        >
                          详情
                        </Button>
                        <span className="text-ink-faint text-[10px]">·</span>
                        <Button
                          variant="link"
                          size="sm"
                          disabled={revoked}
                          onClick={() => setRevokeDlg({ open: true, code: c })}
                          data-testid={`codes-row-revoke-${c.codeId}`}
                          className="text-clay hover:text-clay disabled:opacity-40"
                        >
                          吊销
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {isError && <TableError onRetry={() => refetch()} />}
          {list.length === 0 && !loading && !isError && <TableEmpty>No codes in this folio.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1}
              pageSize={query.pageSize ?? 10}
              total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
              onPageSizeChange={(size) => setQuery((q) => ({ ...q, pageSize: size, pageNo: 1 }))}
            />
          </div>
        </Card>
      </section>

      {/* Revoke confirm */}
      <Dialog
        open={revokeDlg.open}
        onOpenChange={(open) => setRevokeDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="w-[min(420px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · revoke</DialogSeal>
            <DialogTitle>确认吊销认养码?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[13px] text-ink break-all">
              {String(revokeDlg.code?.code ?? '')}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button
              variant="danger"
              onClick={handleRevoke}
              disabled={revoking}
              data-testid="codes-revoke-submit"
            >
              {revoking ? '吊销中...' : '确认吊销'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 认养码详情 · row snapshot + fresh GET /admin/adoption-codes/{id} 合并, 完整权限矩阵 */}
      <Dialog
        open={detailDlg.open}
        onOpenChange={(open) => {
          if (!open) setDetailDlg({ open: false, code: null, loading: false })
        }}
      >
        <DialogContent className="w-[min(560px,calc(100vw-32px))]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · code</DialogSeal>
            <DialogTitle>认养码详情</DialogTitle>
            <DialogDescription>
              Folio record merged from list snapshot and GET /admin/adoption-codes/&#123;id&#125;.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailDlg.code ? (() => {
              const c = detailDlg.code as AdoptionCode & {
                codeType?: string
                orderId?: number
                plotId?: number
                cropBatchId?: number | null
                bindUserId?: number | null
                validFrom?: string
                validTo?: string
                dailyAccessStart?: string
                dailyAccessEnd?: string
                canViewLive?: number
                canViewHistory?: number
                historyDays?: number
                canViewSensor?: number
                canOperate?: number
                shareable?: number
                maxDailyOperations?: number
                operationWhitelist?: string[] | string
                createdByUserId?: number
                createdAt?: string
                updatedAt?: string
              }
              const meta = statusMeta(String(c.status ?? ''))
              const flag = (v?: number) => v === 1 ? <Badge tone="sage">允许</Badge> : <Badge tone="neutral">否</Badge>
              const whitelist: string[] = Array.isArray(c.operationWhitelist)
                ? c.operationWhitelist
                : typeof c.operationWhitelist === 'string' && c.operationWhitelist
                  ? (() => { try { return JSON.parse(c.operationWhitelist) } catch { return [] } })()
                  : []
              return (
                <dl className="grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">codeId</dt>
                  <dd className="font-folio text-ink">
                    {c.codeId}
                    {detailDlg.loading ? (
                      <span className="font-folio text-[11px] text-ink-faint ml-2">refreshing…</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">code</dt>
                  <dd className="font-folio text-[13px] text-ink break-all">{String(c.code ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">type</dt>
                  <dd className="text-ink">{String(c.codeType ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">status</dt>
                  <dd><Badge tone={meta.tone}>{meta.cn}</Badge></dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">order</dt>
                  <dd className="font-folio text-ink">{c.orderId != null ? `#${c.orderId}` : '—'}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plot</dt>
                  <dd className="font-folio text-ink">{c.plotId != null ? `#${c.plotId}` : '—'}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">cropBatch</dt>
                  <dd className="font-folio text-ink">{c.cropBatchId != null ? `#${c.cropBatchId}` : '—'}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">bindUser</dt>
                  <dd className="font-folio text-ink">{c.bindUserId != null ? `#${c.bindUserId}` : <span className="text-ink-faint">未兑换</span>}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">validFrom</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(c.validFrom ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">validTo</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(c.validTo ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">dailyAccess</dt>
                  <dd className="font-folio text-[12px] text-ink">
                    {c.dailyAccessStart || c.dailyAccessEnd
                      ? `${String(c.dailyAccessStart ?? '--:--:--').slice(0, 5)} → ${String(c.dailyAccessEnd ?? '--:--:--').slice(0, 5)}`
                      : <span className="text-ink-faint">无限制</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">canViewLive</dt>
                  <dd>{flag(c.canViewLive)}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">canViewHistory</dt>
                  <dd className="flex items-center gap-2">
                    {flag(c.canViewHistory)}
                    {c.canViewHistory === 1 && c.historyDays != null ? (
                      <span className="font-folio text-[11px] text-ink-soft">近 {c.historyDays} 天</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">canViewSensor</dt>
                  <dd>{flag(c.canViewSensor)}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">canOperate</dt>
                  <dd className="flex items-center gap-2">
                    {flag(c.canOperate)}
                    {c.canOperate === 1 && c.maxDailyOperations != null ? (
                      <span className="font-folio text-[11px] text-ink-soft">日限 {c.maxDailyOperations} 次</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">shareable</dt>
                  <dd>{flag(c.shareable)}</dd>
                  {c.canOperate === 1 ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">whitelist</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {whitelist.length > 0 ? (
                          whitelist.map((w) => (
                            <Badge key={w} tone="fog">{w}</Badge>
                          ))
                        ) : (
                          <span className="text-ink-faint font-sans italic text-[12px]">空 · 无可执行动作</span>
                        )}
                      </dd>
                    </>
                  ) : null}
                  {c.createdByUserId != null ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdBy</dt>
                      <dd className="font-folio text-ink">#{c.createdByUserId}</dd>
                    </>
                  ) : null}
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(c.createdAt ?? '—')}</dd>
                  {c.updatedAt ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">updatedAt</dt>
                      <dd className="font-folio text-[12px] text-ink-soft">{String(c.updatedAt)}</dd>
                    </>
                  ) : null}
                </dl>
              )
            })() : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">关闭 Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
