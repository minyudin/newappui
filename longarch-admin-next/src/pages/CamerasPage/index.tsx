import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import {
  Badge, Button, Card, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogSeal, DialogTitle, Input, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui'
import { deleteCamera, listCameras, listPlots, updateCamera } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import RowLead from '@/components/table/RowLead'
import LivePreview from '@/components/camera/LivePreview'
import HardwarePushGuide from '@/components/camera/HardwarePushGuide'
import { toast } from '@/lib/toast'
import type { Camera, PageQuery } from '@/types/api'

/**
 * §7 Cameras · 摄像头管理
 * 对齐 longarch-admin/src/views/CameraManagement.vue
 */

const ALL = '__all__'

interface EditForm {
  cameraId: number | null
  cameraName: string
  streamProtocol: string
  streamApp: string
  streamName: string
  rtmpPushUrl: string
  ptzEnabled: boolean
  playbackEnabled: boolean
}

const EMPTY_EDIT: EditForm = {
  cameraId: null, cameraName: '', streamProtocol: 'rtmp',
  streamApp: '', streamName: '', rtmpPushUrl: '',
  ptzEnabled: false, playbackEnabled: false,
}

export default function CamerasPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<PageQuery & { plotId: string; networkStatus: string }>({
    pageNo: 1, pageSize: 10, plotId: '', networkStatus: '',
  })

  const [editDlg, setEditDlg] = useState<{ open: boolean }>({ open: false })
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  /** 编辑时保留原始 camera 对象, 给 HardwarePushGuide 提供 deviceNo */
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null)

  const [delDlg, setDelDlg] = useState<{ open: boolean; camera: Camera | null }>({
    open: false, camera: null,
  })
  const [deleting, setDeleting] = useState(false)

  // 实时预览 Dialog
  const [previewDlg, setPreviewDlg] = useState<{ open: boolean; camera: Camera | null }>({
    open: false, camera: null,
  })

  // 状态型 · 15s stale + 30s refetch (摄像头在线状态会变化)
  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.plotId) params.plotId = query.plotId
  if (query.networkStatus) params.networkStatus = query.networkStatus
  const { data, isPending: loading } = useQuery({
    queryKey: qk.cameras.list(params),
    queryFn: () => listCameras(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  // 下拉地块列表 · 配置型 (默认 staleTime 2min)
  const plotsParams = { pageNo: 1, pageSize: 100 }
  const { data: plotsData } = useQuery({
    queryKey: qk.plots.list(plotsParams),
    queryFn: () => listPlots(plotsParams),
  })
  const plots = plotsData?.list ?? []

  function openEdit(c: Camera) {
    setEditingCamera(c)
    setEditForm({
      cameraId: c.cameraId,
      cameraName: String(c.cameraName ?? ''),
      streamProtocol: String(c.streamProtocol ?? 'rtmp'),
      streamApp: String(c.streamApp ?? ''),
      streamName: String(c.streamName ?? ''),
      rtmpPushUrl: String(c.rtmpPushUrl ?? ''),
      ptzEnabled: !!c.ptzEnabled,
      playbackEnabled: !!c.playbackEnabled,
    })
    setEditDlg({ open: true })
  }

  async function handleSave() {
    if (!editForm.cameraId) return
    setSaving(true)
    try {
      await updateCamera(editForm.cameraId, {
        cameraName: editForm.cameraName,
        streamProtocol: editForm.streamProtocol,
        streamApp: editForm.streamApp,
        streamName: editForm.streamName,
        rtmpPushUrl: editForm.rtmpPushUrl,
        ptzEnabled: editForm.ptzEnabled,
        playbackEnabled: editForm.playbackEnabled,
      })
      toast.success('更新成功')
      setEditDlg({ open: false })
      queryClient.invalidateQueries({ queryKey: qk.cameras.all() })
    } catch { /* interceptor */ } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delDlg.camera) return
    setDeleting(true)
    try {
      await deleteCamera(delDlg.camera.cameraId)
      toast.success('删除成功')
      setDelDlg({ open: false, camera: null })
      queryClient.invalidateQueries({ queryKey: qk.cameras.all() })
    } catch { /* interceptor */ } finally { setDeleting(false) }
  }

  return (
    <PageShell
      seal="§7 · Camera"
      title="Cameras"
      titleCn="摄 像 头"
      lede="Eyes of the greenhouse. RTMP into the record."
      right={<><span>{total} ENTRIES</span><span>·</span><span>PAGE {String(query.pageNo).padStart(2, '0')}</span></>}
    >
      <section className="folio-page__section flex flex-wrap items-end gap-3" data-testid="cameras-filter">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cameras-filter-plot">PLOT</Label>
          <Select
            value={query.plotId || ALL}
            onValueChange={(v) => setQuery((q) => ({ ...q, plotId: v === ALL ? '' : v, pageNo: 1 }))}
          >
            <SelectTrigger id="cameras-filter-plot" className="w-[200px]"><SelectValue placeholder="All plots" /></SelectTrigger>
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="cameras-filter-net">NETWORK</Label>
          <Select
            value={query.networkStatus || ALL}
            onValueChange={(v) => setQuery((q) => ({ ...q, networkStatus: v === ALL ? '' : v, pageNo: 1 }))}
          >
            <SelectTrigger id="cameras-filter-net" className="w-[140px]"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部 · All</SelectItem>
              <SelectItem value="online">在线 · online</SelectItem>
              <SelectItem value="offline">离线 · offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="folio-page__section" data-testid="cameras-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">No.</TableHead>
                <TableHead className="w-[130px]">Device No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[120px]">Plot</TableHead>
                <TableHead className="w-[80px]">Net</TableHead>
                <TableHead className="w-[80px]">Stream</TableHead>
                <TableHead className="w-[70px]">Proto</TableHead>
                <TableHead className="w-[160px]">Created</TableHead>
                <TableHead className="w-[160px]">Op.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c, idx) => {
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                const isOnline = String(c.networkStatus) === 'online'
                return (
                <TableRow key={c.cameraId} className="row-fx">
                  <TableCell className="font-folio">
                    <RowLead seal={rowSeal} primary={String(c.cameraId).padStart(3, '0')} />
                  </TableCell>
                  <TableCell className="font-folio text-[12px]">{String(c.deviceNo ?? '—')}</TableCell>
                  <TableCell>{String(c.cameraName ?? '—')}</TableCell>
                  <TableCell className="text-[12px]">{String(c.plotName ?? '—')}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`row-fx__dot${isOnline ? ' row-fx__dot--breath' : ''}`}
                        data-tone={isOnline ? 'sage' : 'clay'}
                      />
                      <Badge tone={isOnline ? 'sage' : 'clay'}>
                        {isOnline ? '在线' : '离线'}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`row-fx__dot${c.streaming ? ' row-fx__dot--breath' : ''}`}
                        data-tone={c.streaming ? 'moss' : 'neutral'}
                      />
                      <Badge tone={c.streaming ? 'sage' : 'neutral'}>
                        {c.streaming ? '推流中' : '未推流'}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="font-folio text-[11px]">{String(c.streamProtocol ?? '—')}</TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">{String(c.createdAt ?? '—')}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant="link" size="sm"
                      onClick={() => setPreviewDlg({ open: true, camera: c })}
                      data-testid={`cameras-row-preview-${c.cameraId}`}
                    >预览</Button>
                    <Button variant="link" size="sm" onClick={() => openEdit(c)} data-testid={`cameras-row-edit-${c.cameraId}`}>编辑</Button>
                    <Button
                      variant="link" size="sm"
                      className="text-clay hover:text-clay"
                      onClick={() => setDelDlg({ open: true, camera: c })}
                      data-testid={`cameras-row-del-${c.cameraId}`}
                    >删除</Button>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {list.length === 0 && !loading && <TableEmpty>No cameras.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 10} total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>

      {/* Edit */}
      <Dialog open={editDlg.open} onOpenChange={(open) => setEditDlg({ open })}>
        <DialogContent className="w-[min(520px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ FORM · edit camera</DialogSeal>
            <DialogTitle>编辑摄像头</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              {/* 推流配置卡 · 给硬件师傅看 (实时反映编辑中的 streamName / app 修改) */}
              {editingCamera ? (
                <HardwarePushGuide
                  deviceNo={String(editingCamera.deviceNo ?? '')}
                  streamProtocol={editForm.streamProtocol}
                  rtmpPushUrl={
                    editForm.rtmpPushUrl ||
                    String(editingCamera.rtmpPushUrl ?? '')
                  }
                  streamName={
                    editForm.streamName ||
                    String(editingCamera.streamName ?? editingCamera.deviceNo ?? '')
                  }
                  streamApp={editForm.streamApp || 'live'}
                  compact
                />
              ) : null}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cam-name">NAME</Label>
                <Input id="cam-name" value={editForm.cameraName}
                  onChange={(e) => setEditForm((f) => ({ ...f, cameraName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cam-proto">PROTOCOL</Label>
                  <Select
                    value={editForm.streamProtocol}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, streamProtocol: v }))}
                  >
                    <SelectTrigger id="cam-proto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rtmp">RTMP</SelectItem>
                      <SelectItem value="webrtc">WebRTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cam-app">STREAM APP</Label>
                  <Input id="cam-app" value={editForm.streamApp}
                    onChange={(e) => setEditForm((f) => ({ ...f, streamApp: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cam-streamname">STREAM NAME</Label>
                <Input id="cam-streamname" value={editForm.streamName}
                  onChange={(e) => setEditForm((f) => ({ ...f, streamName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cam-rtmp">RTMP PUSH URL</Label>
                <Input id="cam-rtmp" value={editForm.rtmpPushUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, rtmpPushUrl: e.target.value }))} />
              </div>
              <div className="flex gap-4 font-folio text-[11px] uppercase tracking-widest text-ink-soft">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.ptzEnabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, ptzEnabled: e.target.checked }))} />
                  PTZ · 云台
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.playbackEnabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, playbackEnabled: e.target.checked }))} />
                  PLAYBACK · 回放
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleSave} disabled={saving} data-testid="cameras-save">
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={delDlg.open} onOpenChange={(open) => setDelDlg((d) => ({ ...d, open }))}>
        <DialogContent className="w-[min(420px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · delete</DialogSeal>
            <DialogTitle>确认删除该摄像头?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[13px] text-ink">
              {String(delDlg.camera?.cameraName ?? '')} · {String(delDlg.camera?.deviceNo ?? '')}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="danger" onClick={handleDelete} disabled={deleting} data-testid="cameras-del-submit">
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Preview · 浏览器 flv.js / hls.js 直接播 */}
      <Dialog
        open={previewDlg.open}
        onOpenChange={(open) => setPreviewDlg((p) => ({ ...p, open }))}
      >
        <DialogContent className="w-[min(960px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ LIVE · preview</DialogSeal>
            <DialogTitle>
              {String(previewDlg.camera?.cameraName ?? '摄像头')} · 实时画面
            </DialogTitle>
            <DialogDescription>
              {previewDlg.camera?.streaming
                ? '当前正在推流, 浏览器 flv.js 直连 SRS, 延迟约 3 秒'
                : '当前 SRS 未检测到推流, 请确认摄像头/ffmpeg 已开始推流'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {previewDlg.camera ? (
              <div className="flex flex-col gap-3">
                <LivePreview
                  flvUrl={previewDlg.camera.flvPlayUrl as string | undefined}
                  hlsUrl={previewDlg.camera.hlsPlayUrl as string | undefined}
                  poster={previewDlg.camera.snapshotUrl as string | undefined}
                />
                <HardwarePushGuide
                  deviceNo={previewDlg.camera.deviceNo as string | undefined}
                  streamProtocol={previewDlg.camera.streamProtocol as string | undefined}
                  rtmpPushUrl={previewDlg.camera.rtmpPushUrl as string | undefined}
                  streamName={previewDlg.camera.streamName as string | undefined}
                  streamApp={previewDlg.camera.streamApp as string | undefined}
                />
                <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5 text-[12px] font-folio">
                  <span className="text-ink-faint uppercase tracking-wider">FLV</span>
                  <span className="text-ink break-all">
                    {String(previewDlg.camera.flvPlayUrl ?? '—')}
                  </span>
                  <span className="text-ink-faint uppercase tracking-wider">HLS</span>
                  <span className="text-ink break-all">
                    {String(previewDlg.camera.hlsPlayUrl ?? '—')}
                  </span>
                  <span className="text-ink-faint uppercase tracking-wider">推流</span>
                  <span className="text-ink">
                    {previewDlg.camera.streaming ? (
                      <Badge tone="sage">推流中</Badge>
                    ) : (
                      <Badge tone="neutral">未推流</Badge>
                    )}
                  </span>
                </div>
              </div>
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
