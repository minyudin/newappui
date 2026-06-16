import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import {
  Badge, Button, Card, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogSeal, DialogTitle, Input, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui'
import { getDeviceDetail, listDevices, retireActuatorDevice, unlockDevice } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import RowLead from '@/components/table/RowLead'
import { toast } from '@/lib/toast'
import type { ActuatorDevice, PageQuery } from '@/types/api'

/**
 * §8 Devices · 执行设备
 * 对齐 longarch-admin/src/views/Devices.vue
 */

const ALL = '__all__'

/** 设备类型中文化 */
const DEVICE_TYPE_LABEL: Record<string, string> = {
  fertigation_machine: '水肥一体机',
  shade_controller: '遮阳帘控制器',
  wet_curtain_controller: '湿帘控制器',
  ventilation_fan_controller: '换气扇控制器',
}
function deviceTypeLabel(t?: string) {
  return t ? (DEVICE_TYPE_LABEL[t] ?? t) : '—'
}

const STATUS_LABEL: Record<string, string> = {
  online: '在线',
  offline: '离线',
  idle: '空闲',
  running: '运行中',
  registered: '已注册',
}
function statusTone(s?: string): 'sage' | 'clay' | 'sand' | 'neutral' {
  if (s === 'online' || s === 'idle') return 'sage'
  if (s === 'offline') return 'clay'
  if (s === 'running') return 'sand'
  return 'neutral'
}
function statusLabel(s?: string) {
  return s ? (STATUS_LABEL[s] ?? s) : '—'
}

function formatDuration(sec?: number | null) {
  if (sec == null || Number.isNaN(sec) || sec < 0) return '—'
  const total = Math.floor(sec)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function onlineDurationLabel(device: ActuatorDevice) {
  const sec = device.heartbeatAgeSeconds
  const pretty = formatDuration(sec)
  const status = (device.deviceStatus ?? '').toLowerCase()
  if (pretty === '—') return '—'
  if (status === 'online' || status === 'idle' || status === 'running') {
    return `在线 ${pretty}`
  }
  return `离线 ${pretty}`
}

const LOCK_LABEL: Record<string, string> = {
  free: '空闲',
  locked: '锁定',
  unknown: '—',
}

export default function DevicesPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<PageQuery & { deviceStatus: string }>({
    pageNo: 1, pageSize: 10, deviceStatus: '',
  })
  const [unlockDlg, setUnlockDlg] = useState<{ open: boolean; device: ActuatorDevice | null }>({
    open: false, device: null,
  })
  const [unlocking, setUnlocking] = useState(false)

  const [detailDlg, setDetailDlg] = useState<{
    open: boolean
    device: ActuatorDevice | null
    loading: boolean
  }>({ open: false, device: null, loading: false })

  const [retireDlg, setRetireDlg] = useState<{
    open: boolean
    device: ActuatorDevice | null
    reason: string
  }>({ open: false, device: null, reason: '' })
  const [retiring, setRetiring] = useState(false)

  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.deviceStatus) params.deviceStatus = query.deviceStatus
  const { data, isPending: loading } = useQuery({
    queryKey: qk.devices.list(params),
    queryFn: () => listDevices(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  async function handleUnlock() {
    if (!unlockDlg.device) return
    setUnlocking(true)
    try {
      await unlockDevice(unlockDlg.device.deviceId, { reason: '管理员强制解锁' })
      toast.success('设备已解锁')
      setUnlockDlg({ open: false, device: null })
      queryClient.invalidateQueries({ queryKey: qk.devices.all() })
    } catch { /* interceptor */ } finally { setUnlocking(false) }
  }

  // 详情 · 弹窗里先拿列表行的 snapshot 显示, 再异步拉 getDeviceDetail 补齐锁状态 / 任务 id
  async function openDetail(row: ActuatorDevice) {
    setDetailDlg({ open: true, device: row, loading: true })
    try {
      const fresh = await getDeviceDetail(row.deviceId)
      setDetailDlg({ open: true, device: { ...row, ...fresh }, loading: false })
    } catch {
      // interceptor 已 toast; 保留 row 快照, 仅关掉 loading
      setDetailDlg((prev) => ({ ...prev, loading: false }))
    }
  }

  async function handleRetire() {
    if (!retireDlg.device) return
    const reason = retireDlg.reason.trim()
    if (!reason) {
      toast.warning('请填写停用原因 (审计必填)')
      return
    }
    setRetiring(true)
    try {
      await retireActuatorDevice(retireDlg.device.deviceId, { reason })
      toast.success('设备已停用')
      setRetireDlg({ open: false, device: null, reason: '' })
      queryClient.invalidateQueries({ queryKey: qk.devices.all() })
    } catch {
      // 后端 INVALID_PARAM: 『设备存在未完成任务，禁止停用』已由拦截器 toast
      // 保持 dialog 打开, 让用户先取消那些任务再来
    } finally {
      setRetiring(false)
    }
  }

  return (
    <PageShell
      seal="§8 · Actuators"
      title="Actuators"
      titleCn="执 行 设 备"
      lede="Water, shade, vent, cool. The hands we can raise."
      right={<><span>{total} ENTRIES</span><span>·</span><span>PAGE {String(query.pageNo).padStart(2, '0')}</span></>}
    >
      <section className="folio-page__section flex flex-wrap items-end gap-3" data-testid="devices-filter">
        <div className="flex flex-col gap-2">
          <Label htmlFor="devices-filter-status">STATUS</Label>
          <Select
            value={query.deviceStatus || ALL}
            onValueChange={(v) => setQuery((q) => ({ ...q, deviceStatus: v === ALL ? '' : v, pageNo: 1 }))}
          >
            <SelectTrigger id="devices-filter-status" className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部 · All</SelectItem>
              <SelectItem value="online">在线 · online</SelectItem>
              <SelectItem value="offline">离线 · offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="folio-page__section" data-testid="devices-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Device</TableHead>
                <TableHead className="min-w-[120px]">Plot</TableHead>
                <TableHead className="w-[130px]">Type</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[170px]">Last Heartbeat</TableHead>
                <TableHead className="w-[130px]">Duration</TableHead>
                <TableHead className="w-[80px]">Lock</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead className="w-[220px] whitespace-nowrap">Op.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d, idx) => {
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                const isOnline = d.deviceStatus === 'online'
                const isLocked = d.lockStatus === 'locked'
                return (
                <TableRow key={d.deviceId} className="row-fx">
                  <TableCell className="text-[13px]">
                    <RowLead
                      seal={rowSeal}
                      primary={d.deviceName ?? '—'}
                      secondary={d.deviceNo ?? undefined}
                    />
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {d.plotName ? (
                      <span className="text-ink">{d.plotName}</span>
                    ) : (
                      <span className="text-ink-faint italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-ink">{deviceTypeLabel(d.deviceType)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`row-fx__dot${isOnline ? ' row-fx__dot--breath' : ''}`}
                        data-tone={statusTone(d.deviceStatus)}
                      />
                      <Badge tone={statusTone(d.deviceStatus)}>{statusLabel(d.deviceStatus)}</Badge>
                    </span>
                  </TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">
                    {d.lastHeartbeatAt ?? '—'}
                  </TableCell>
                  <TableCell className="text-[12px] text-ink-soft">
                    {onlineDurationLabel(d)}
                  </TableCell>
                  <TableCell>
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="row-fx__dot row-fx__dot--breath" data-tone="clay" />
                        <span className="text-clay text-[12px]">{LOCK_LABEL[d.lockStatus ?? ''] ?? d.lockStatus}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-soft">{LOCK_LABEL[d.lockStatus ?? ''] ?? d.lockStatus ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">{String(d.createdAt ?? '—')}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="link" size="sm"
                        onClick={() => openDetail(d)}
                        data-testid={`devices-row-detail-${d.deviceId}`}
                      >详情</Button>
                      <span className="text-ink-faint text-[10px]">·</span>
                      <Button
                        variant="link" size="sm"
                        disabled={d.lockStatus !== 'locked'}
                        onClick={() => setUnlockDlg({ open: true, device: d })}
                        data-testid={`devices-row-unlock-${d.deviceId}`}
                      >解锁</Button>
                      <span className="text-ink-faint text-[10px]">·</span>
                      <Button
                        variant="link" size="sm"
                        className="text-clay hover:text-clay disabled:opacity-40"
                        disabled={d.deviceStatus === 'retired'}
                        onClick={() => setRetireDlg({ open: true, device: d, reason: '' })}
                        data-testid={`devices-row-retire-${d.deviceId}`}
                      >停用</Button>
                    </div>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {list.length === 0 && !loading && <TableEmpty>No devices.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 10} total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>

      <Dialog open={unlockDlg.open} onOpenChange={(open) => setUnlockDlg((d) => ({ ...d, open }))}>
        <DialogContent className="w-[min(420px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · unlock</DialogSeal>
            <DialogTitle>确定强制解锁设备?</DialogTitle>
            <DialogDescription>This will release any held operation lock.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[13px] text-ink">
              {String(unlockDlg.device?.deviceName ?? '')} · {String(unlockDlg.device?.deviceNo ?? '')}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleUnlock} disabled={unlocking} data-testid="devices-unlock-submit">
              {unlocking ? '解锁中...' : '确认解锁'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情 · 合并列表 row snapshot 与 getDeviceDetail 的锁状态 */}
      <Dialog
        open={detailDlg.open}
        onOpenChange={(open) => {
          if (!open) setDetailDlg({ open: false, device: null, loading: false })
        }}
      >
        <DialogContent className="w-[min(520px,calc(100vw-32px))]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · actuator</DialogSeal>
            <DialogTitle>执行设备详情</DialogTitle>
            <DialogDescription>
              Folio record merged from list snapshot and GET /admin/actuator-devices/&#123;id&#125;.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailDlg.device ? (
              <dl className="grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">deviceId</dt>
                <dd className="font-folio text-ink">{detailDlg.device.deviceId}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">deviceNo</dt>
                <dd className="font-folio text-[12px] text-ink break-all">{detailDlg.device.deviceNo ?? '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">name</dt>
                <dd className="text-ink">{detailDlg.device.deviceName ?? '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">type</dt>
                <dd className="text-ink">{deviceTypeLabel(detailDlg.device.deviceType)}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plot</dt>
                <dd className="text-ink">
                  {detailDlg.device.plotName ?? '—'}
                  {detailDlg.device.plotId ? (
                    <span className="font-folio text-[11px] text-ink-faint ml-1">
                      #{detailDlg.device.plotId}
                    </span>
                  ) : null}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">deviceStatus</dt>
                <dd>
                  <Badge tone={statusTone(detailDlg.device.deviceStatus)}>
                    {statusLabel(detailDlg.device.deviceStatus)}
                  </Badge>
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">networkStatus</dt>
                <dd className="text-ink">{String(detailDlg.device.networkStatus ?? '—')}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">lockStatus</dt>
                <dd className="text-ink">
                  {LOCK_LABEL[detailDlg.device.lockStatus ?? ''] ?? detailDlg.device.lockStatus ?? '—'}
                  {detailDlg.loading ? (
                    <span className="font-folio text-[11px] text-ink-faint ml-2">refreshing…</span>
                  ) : null}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">currentTask</dt>
                <dd className="font-folio text-ink">
                  {detailDlg.device.currentTaskId != null ? `#${detailDlg.device.currentTaskId}` : '—'}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">lockedAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">
                  {String((detailDlg.device as { lockedAt?: string }).lockedAt ?? '—')}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">lockExpireAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">
                  {String((detailDlg.device as { lockExpireAt?: string }).lockExpireAt ?? '—')}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">lastHeartbeat</dt>
                <dd className="font-folio text-[12px] text-ink-soft">
                  {detailDlg.device.lastHeartbeatAt ?? '—'}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">onlineFor</dt>
                <dd className="font-folio text-[12px] text-ink">
                  {onlineDurationLabel(detailDlg.device)}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">{detailDlg.device.createdAt ?? '—'}</dd>
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

      {/* 停用 · 带必填 reason 的二次确认, 后端前置校验未完成任务会直接拦下 */}
      <Dialog
        open={retireDlg.open}
        onOpenChange={(open) => setRetireDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="w-[min(460px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · retire</DialogSeal>
            <DialogTitle>停用执行设备?</DialogTitle>
            <DialogDescription>
              软删除 + 打 retired 标记 + 写审计日志。存在未完成任务时后端会拒绝。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div className="font-folio text-[13px] text-ink">
                {String(retireDlg.device?.deviceName ?? '')} · {String(retireDlg.device?.deviceNo ?? '')}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="devices-retire-reason">REASON *</Label>
                <Input
                  id="devices-retire-reason"
                  value={retireDlg.reason}
                  onChange={(e) => setRetireDlg((d) => ({ ...d, reason: e.target.value }))}
                  placeholder="例: 水泵损坏, 物理撤场"
                  maxLength={200}
                  data-testid="devices-retire-reason"
                />
                <span className="font-folio text-[11px] text-ink-faint">
                  写入 device_lifecycle_log.reason · 审计可追溯
                </span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button
              variant="danger"
              onClick={handleRetire}
              disabled={retiring}
              data-testid="devices-retire-submit"
            >
              {retiring ? '停用中...' : '确认停用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
