import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import { PlotSelect, UserSelect } from '@/components/selects'
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
import { createOrder, listOrders, updateOrderStatus } from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import RowLead from '@/components/table/RowLead'
import type { AdminUser, AdoptionOrder, PageQuery, Plot } from '@/types/api'

/**
 * §3 Orders · 认养订单
 * ============================================================
 *  对齐 longarch-admin/src/views/Orders.vue
 *  · 筛选: orderStatus
 *  · 列表 + 变更状态操作
 *  · 新建订单 Dialog
 * ============================================================ */

const STATUS_OPTIONS: { value: string; cn: string; tone: 'sand' | 'fog' | 'moss' | 'neutral' | 'clay' | 'plum' }[] = [
  { value: 'pending',   cn: '待处理', tone: 'sand' },
  { value: 'active',    cn: '进行中', tone: 'fog' },
  { value: 'completed', cn: '已完成', tone: 'moss' },
  { value: 'cancelled', cn: '已取消', tone: 'neutral' },
]

const ALL_STATUS = '__all__'

function statusMeta(s?: string) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { value: s ?? '—', cn: s ?? '—', tone: 'neutral' as const }
}

interface CreateForm {
  plotId: string
  userId: string
  startAt: string
  endAt: string
  payableAmount: string
  remark: string
}

const EMPTY_CREATE: CreateForm = {
  plotId: '', userId: '', startAt: '', endAt: '', payableAmount: '', remark: '',
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState<PageQuery & { orderStatus: string }>(
    { pageNo: 1, pageSize: 10, orderStatus: '' },
  )

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  // SearchableSelect 的 Trigger 需要完整实体才能显示人读名字; 这里存选中对象
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  // §跨页联动·URL 预填一次性消费 (plotsPage 点「新建订单」跳过来)
  //   ?prefillPlotId=123&prefillPlotName=温室A&openCreate=1
  //  读完立即清 URL, 避免 F5 重复自动开 Dialog.
  const prefillConsumedRef = useRef(false)
  useEffect(() => {
    if (prefillConsumedRef.current) return
    const pPlotId = searchParams.get('prefillPlotId')
    const pPlotName = searchParams.get('prefillPlotName')
    const pUserId = searchParams.get('prefillUserId')
    const pUserName = searchParams.get('prefillUserName')
    const pOpen = searchParams.get('openCreate') === '1'
    if (!pPlotId && !pUserId && !pOpen) return
    prefillConsumedRef.current = true
    setCreateForm((f) => ({
      ...f,
      plotId: pPlotId || f.plotId,
      userId: pUserId || f.userId,
    }))
    if (pPlotId) {
      setSelectedPlot({
        plotId: Number(pPlotId),
        plotName: pPlotName || undefined,
      } as Plot)
    }
    if (pUserId) {
      setSelectedUser({
        userId: Number(pUserId),
        nickname: pUserName || '',
      } as AdminUser)
    }
    if (pOpen) setShowCreate(true)
    // 把 URL 上的 prefill/openCreate 清掉, 保留其他 query · replace 不进历史栈
    const next = new URLSearchParams(searchParams)
    ;['prefillPlotId', 'prefillPlotName', 'prefillUserId', 'prefillUserName', 'openCreate'].forEach(
      (k) => next.delete(k),
    )
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const [statusDlg, setStatusDlg] = useState<{
    open: boolean
    orderId: number | null
    current: string
    next: string
    remark: string
  }>({ open: false, orderId: null, current: '', next: '', remark: '' })
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // 详情抽屉 · 纯前端展示, 不走新 API (后端暂无 /admin/adoption-orders/{id})
  const [detailOrder, setDetailOrder] = useState<AdoptionOrder | null>(null)

  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.orderStatus) params.orderStatus = query.orderStatus
  const {
    data,
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: qk.orders.list(params),
    queryFn: () => listOrders(params),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  async function handleCreate() {
    if (!createForm.plotId || !createForm.startAt || !createForm.endAt) {
      toast.warning('plotId / startAt / endAt 均为必填')
      return
    }
    setCreating(true)
    try {
      await createOrder({
        plotId: Number(createForm.plotId),
        userId: createForm.userId ? Number(createForm.userId) : undefined,
        startAt: createForm.startAt.replace('T', ' ') + ':00',
        endAt: createForm.endAt.replace('T', ' ') + ':00',
        payableAmount: createForm.payableAmount ? Number(createForm.payableAmount) : undefined,
        remark: createForm.remark || undefined,
      })
      toast.success('创建成功')
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      setSelectedPlot(null)
      setSelectedUser(null)
      setQuery((q) => ({ ...q, pageNo: 1 }))
      queryClient.invalidateQueries({ queryKey: qk.orders.all() })
    } catch {
      /* interceptor */
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateStatus() {
    if (!statusDlg.next || !statusDlg.orderId) {
      toast.warning('请选择新状态')
      return
    }
    setUpdatingStatus(true)
    try {
      await updateOrderStatus(statusDlg.orderId, {
        orderStatus: statusDlg.next,
        remark: statusDlg.remark || undefined,
      })
      toast.success('状态已更新')
      setStatusDlg({ open: false, orderId: null, current: '', next: '', remark: '' })
      queryClient.invalidateQueries({ queryKey: qk.orders.all() })
    } catch {
      /* interceptor */
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <PageShell
      seal="§3 · Orders"
      title="Adoption Orders"
      titleCn="认 养 订 单"
      lede="A contract between a person and a plot."
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
        data-testid="orders-filter"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="orders-filter-status">STATUS</Label>
            <Select
              value={query.orderStatus || ALL_STATUS}
              onValueChange={(v) =>
                setQuery((q) => ({ ...q, orderStatus: v === ALL_STATUS ? '' : v, pageNo: 1 }))
              }
            >
              <SelectTrigger id="orders-filter-status" className="w-[180px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS}>全部 · All</SelectItem>
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
            <Button variant="primary" data-testid="orders-create-trigger">
              + 新建订单
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[min(560px,calc(100vw-32px))]">
            <DialogHeader>
              <DialogSeal>§ FORM · new order</DialogSeal>
              <DialogTitle>新建认养订单</DialogTitle>
              <DialogDescription>Link a plot with a person for a span of time.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="order-plot-id">PLOT *</Label>
                  <PlotSelect
                    id="order-plot-id"
                    value={createForm.plotId}
                    selectedItem={selectedPlot}
                    onChange={(v, item) => {
                      setCreateForm((f) => ({ ...f, plotId: v }))
                      setSelectedPlot(item)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="order-user-id">USER</Label>
                  <UserSelect
                    id="order-user-id"
                    value={createForm.userId}
                    selectedItem={selectedUser}
                    onChange={(v, item) => {
                      setCreateForm((f) => ({ ...f, userId: v }))
                      setSelectedUser(item)
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="order-start">START *</Label>
                  <Input
                    id="order-start"
                    type="datetime-local"
                    value={createForm.startAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startAt: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="order-end">END *</Label>
                  <Input
                    id="order-end"
                    type="datetime-local"
                    value={createForm.endAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endAt: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="order-amount">AMOUNT</Label>
                  <Input
                    id="order-amount"
                    type="number"
                    step="0.01"
                    min={0}
                    value={createForm.payableAmount}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, payableAmount: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label htmlFor="order-remark">REMARK</Label>
                  <Input
                    id="order-remark"
                    value={createForm.remark}
                    onChange={(e) => setCreateForm((f) => ({ ...f, remark: e.target.value }))}
                  />
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">取消</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={creating}
                data-testid="orders-create-submit"
              >
                {creating ? '提交中...' : '提交'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Table */}
      <section className="folio-page__section" data-testid="orders-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[140px]">Order No.</TableHead>
                <TableHead className="min-w-[180px]">User</TableHead>
                <TableHead className="min-w-[160px]">Plot</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Amount</TableHead>
                <TableHead className="w-[160px]">Created</TableHead>
                <TableHead className="min-w-[160px] whitespace-nowrap">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o, idx) => {
                const meta = statusMeta(o.orderStatus)
                const breath = o.orderStatus === 'pending' || o.orderStatus === 'active'
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                return (
                  <TableRow key={o.orderId} className="row-fx">
                    <TableCell className="font-folio">
                      <RowLead seal={rowSeal} primary={String(o.orderId).padStart(3, '0')} />
                    </TableCell>
                    <TableCell className="font-folio text-[12px]">{String(o.orderNo ?? '—')}</TableCell>
                    <TableCell className="text-[13px]">
                      {o.userId ? (
                        <RowLead
                          primary={String(o.userNickname ?? o.userName ?? '—')}
                          secondary={`#${o.userId}${o.userMobile ? ` · ${o.userMobile}` : ''}`}
                        />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {o.plotId ? (
                        <RowLead
                          primary={String(o.plotName ?? o.plotTitle ?? '—')}
                          secondary={`#${o.plotId}${o.plotNo ? ` · ${o.plotNo}` : ''}`}
                        />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell>{String(o.adoptionType ?? '—')}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`row-fx__dot${breath ? ' row-fx__dot--breath' : ''}`} data-tone={meta.tone} />
                        <Badge tone={meta.tone}>{meta.cn}</Badge>
                      </span>
                    </TableCell>
                    <TableCell>
                      {o.payableAmount != null ? (
                        <span className={`row-fx__amount${Number(o.payableAmount) === 0 ? ' row-fx__amount--zero' : ''}`}>
                          {String(o.payableAmount)}
                          <span className="row-fx__amount--currency">CNY</span>
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-folio text-[11px] text-ink-soft">{String(o.createdAt ?? '—')}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setDetailOrder(o)}
                          data-testid={`orders-row-detail-${o.orderId}`}
                        >
                          详情
                        </Button>
                        <span className="text-ink-faint text-[10px]">·</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setStatusDlg({
                            open: true,
                            orderId: o.orderId,
                            current: o.orderStatus,
                            next: '',
                            remark: '',
                          })}
                          data-testid={`orders-row-status-${o.orderId}`}
                        >
                          变更状态
                        </Button>
                        <span className="text-ink-faint text-[10px]">·</span>
                        {/* 跨页联动 · 带 order 身份跳去生成认养码 */}
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            const orderNo = String(o.orderNo ?? '')
                            const qs = new URLSearchParams({
                              prefillOrderId: String(o.orderId),
                              ...(orderNo ? { prefillOrderNo: orderNo } : {}),
                              openCreate: '1',
                            })
                            navigate(`/codes?${qs.toString()}`)
                          }}
                          data-testid={`orders-row-new-code-${o.orderId}`}
                        >
                          + 认养码
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {isError && <TableError onRetry={() => refetch()} />}
          {list.length === 0 && !loading && !isError && <TableEmpty>No orders in this folio.</TableEmpty>}
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

      {/* Status dialog */}
      <Dialog
        open={statusDlg.open}
        onOpenChange={(open) => setStatusDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="w-[min(440px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · transition</DialogSeal>
            <DialogTitle>变更订单状态</DialogTitle>
            <DialogDescription>Move order to a new stage in its lifecycle.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Label className="w-[80px]">CURRENT</Label>
                <Badge tone={statusMeta(statusDlg.current).tone}>
                  {statusMeta(statusDlg.current).cn}
                </Badge>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-status-next">NEW STATUS *</Label>
                <Select
                  value={statusDlg.next}
                  onValueChange={(v) => setStatusDlg((d) => ({ ...d, next: v }))}
                >
                  <SelectTrigger id="order-status-next">
                    <SelectValue placeholder="pick a new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.cn} · {s.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-status-remark">REMARK</Label>
                <Input
                  id="order-status-remark"
                  value={statusDlg.remark}
                  onChange={(e) => setStatusDlg((d) => ({ ...d, remark: e.target.value }))}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button
              variant="primary"
              onClick={handleUpdateStatus}
              disabled={updatingStatus}
              data-testid="orders-status-submit"
            >
              {updatingStatus ? '确认中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 订单详情 · 展示列表 row 全部字段, 无需单独 API */}
      <Dialog open={detailOrder != null} onOpenChange={(open) => { if (!open) setDetailOrder(null) }}>
        <DialogContent className="w-[min(560px,calc(100vw-32px))]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · order</DialogSeal>
            <DialogTitle>认养订单详情</DialogTitle>
            <DialogDescription>Folio record for this order. Values mirror the list API payload.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailOrder ? (
              <dl className="grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">orderId</dt>
                <dd className="font-folio text-ink">{detailOrder.orderId}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">orderNo</dt>
                <dd className="font-folio text-[12px] text-ink break-all">{String(detailOrder.orderNo ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">status</dt>
                <dd>
                  {(() => {
                    const meta = statusMeta(detailOrder.orderStatus)
                    return <Badge tone={meta.tone}>{meta.cn}</Badge>
                  })()}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">payStatus</dt>
                <dd className="text-ink">{String((detailOrder as { payStatus?: string }).payStatus ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">user</dt>
                <dd className="text-ink">
                  {detailOrder.userId ? (
                    <>
                      <span>{String(detailOrder.userNickname ?? detailOrder.userName ?? '—')}</span>
                      <span className="font-folio text-[11px] text-ink-faint ml-2">#{detailOrder.userId}</span>
                      {detailOrder.userMobile ? (
                        <span className="font-folio text-[11px] text-ink-soft ml-2">{String(detailOrder.userMobile)}</span>
                      ) : null}
                    </>
                  ) : <span className="text-ink-faint">未绑定</span>}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plot</dt>
                <dd className="text-ink">
                  {detailOrder.plotId ? (
                    <>
                      <span>{String(detailOrder.plotName ?? detailOrder.plotTitle ?? '—')}</span>
                      <span className="font-folio text-[11px] text-ink-faint ml-2">#{detailOrder.plotId}</span>
                      {detailOrder.plotNo ? (
                        <span className="font-folio text-[11px] text-ink-soft ml-2">{String(detailOrder.plotNo)}</span>
                      ) : null}
                    </>
                  ) : <span className="text-ink-faint">—</span>}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">cropBatch</dt>
                <dd className="font-folio text-ink">
                  {(detailOrder as { cropBatchId?: number | null }).cropBatchId != null
                    ? `#${(detailOrder as { cropBatchId?: number | null }).cropBatchId}`
                    : '—'}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">type</dt>
                <dd className="text-ink">{String(detailOrder.adoptionType ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">amount</dt>
                <dd className="font-folio text-ink">{detailOrder.payableAmount != null ? String(detailOrder.payableAmount) : '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">visibility</dt>
                <dd className="font-folio text-[12px] text-ink">{String((detailOrder as { visibilityLevel?: string }).visibilityLevel ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">operation</dt>
                <dd className="font-folio text-[12px] text-ink">{String((detailOrder as { operationLevel?: string }).operationLevel ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">startAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">{String((detailOrder as { startAt?: string }).startAt ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">endAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">{String((detailOrder as { endAt?: string }).endAt ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdBy</dt>
                <dd className="font-folio text-ink">{(detailOrder as { createdBy?: number }).createdBy ? `#${(detailOrder as { createdBy?: number }).createdBy}` : '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">{String(detailOrder.createdAt ?? '—')}</dd>
                {(detailOrder as { remark?: string }).remark ? (
                  <>
                    <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">remark</dt>
                    <dd className="text-ink break-all">{String((detailOrder as { remark?: string }).remark)}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
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
