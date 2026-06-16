import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import {
  Button, Card, Dialog, DialogBody, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogSeal, DialogTitle, DialogTrigger, Input, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge,
} from '@/components/ui'
import {
  bindActuator, bindCamera, bindScreen, bindSensor, createCropBatch, createPlot, getPlotDetail,
  listDevices, listPlots, listSensorDevices, retireActuatorDevice, retireSensorDevice, updatePlot,
} from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import type { PageQuery, Plot } from '@/types/api'
import PlotTree, { type PlotTreeAction } from './PlotTree'
import HardwarePushGuide from '@/components/camera/HardwarePushGuide'

/**
 * §5 Plots · 地块管理 (C.1 嵌套列表重构 · 2026-05)
 * ============================================================
 *  历史版: 一张大平铺表, 12 列, 每行 6 - 8 个绑定按钮, 一屏 8 行不够看
 *  现版本: PlotTree 把"大棚 + 子点位"按 parentId 嵌成两层
 *    §大棚 · 名 + 子点位数 + 总面积 + 状态 + [详情/绑大屏]
 *      └ §子点位 · 名 + 面积 + 状态 + 行内抽屉 (温/湿/光/CO2 + 土壤指标 + 5 绑定)
 *
 *  保留:
 *   · 5 个绑定 Dialog (摄像头/传感器/执行设备/大屏/批次) + 2 个详情/编辑 Dialog
 *   · 治理 Dialog (停用执行/传感器)
 *   · 跨页跳订单 (prefillPlotId 系列)
 *
 *  把这些 Dialog 通过 onAction 派发, PlotTree 不直接 mount Dialog
 * ============================================================ */

const ALL = '__all__'

interface CreateForm {
  plotName: string; plotNo: string; farmName: string; parentId: string
  areaSize: string; longitude: string; latitude: string; introText: string
}
const EMPTY_CREATE: CreateForm = { plotName: '', plotNo: '', farmName: '', parentId: '', areaSize: '', longitude: '', latitude: '', introText: '' }

interface CameraForm {
  cameraName: string
  deviceNo: string
  streamProtocol: string
  streamApp: string
  streamName: string
  rtmpPushUrl: string
}
interface SensorForm { sensorName: string; deviceNo: string; sensorType: string; category: string; unit: string }
interface ActuatorForm {
  deviceName: string
  deviceNo: string
  deviceType: string
  replaceDeviceId: string
  replaceReason: string
}
interface ScreenForm { screenName: string; deviceNo: string }
interface BatchForm { cropName: string; varietyName: string; growthStage: string; sowingAt: string; expectedHarvestAt: string }

/** Plot tree 操作派发的对应 Dialog 打开器 · 在主组件里实现 */

export default function PlotsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [query, setQuery] = useState<PageQuery & { parentId: string; plotStatus: string }>({
    pageNo: 1, pageSize: 10, parentId: '', plotStatus: '',
  })

  // 主列表 · 配置型 (默认 staleTime 2min)
  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.parentId) params.parentId = query.parentId
  if (query.plotStatus) params.plotStatus = query.plotStatus
  const { data, isPending: loading } = useQuery({
    queryKey: qk.plots.list(params),
    queryFn: () => listPlots(params),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  // 下拉 greenhouse 列表 · 用 100 条全量
  const plotsAllParams = { pageNo: 1, pageSize: 100 }
  const { data: plotsAll } = useQuery({
    queryKey: qk.plots.list(plotsAllParams),
    queryFn: () => listPlots(plotsAllParams),
  })
  const plots = plotsAll?.list ?? []

  const greenhouses = useMemo(() => plots.filter((p) => !p.parentId), [plots])

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)

  // Bind dialogs (single source keeping plot context)
  const [activePlot, setActivePlot] = useState<Plot | null>(null)
  // 详情抽屉 · 先用列表 row snapshot, 异步 GET /admin/plots/{id} 补齐经纬度/简介等
  const [detailDlg, setDetailDlg] = useState<{
    open: boolean
    plot: Plot | null
    loading: boolean
  }>({ open: false, plot: null, loading: false })

  // 编辑弹窗
  type EditForm = {
    plotName: string
    areaSize: string
    areaUnit: string
    longitude: string
    latitude: string
    plotStatus: string
    liveCoverUrl: string
    introText: string
  }
  const EMPTY_EDIT: EditForm = {
    plotName: '', areaSize: '', areaUnit: 'mu',
    longitude: '', latitude: '',
    plotStatus: 'active', liveCoverUrl: '', introText: '',
  }
  const [editDlg, setEditDlg] = useState<{ open: boolean; plotId: number | null }>({
    open: false, plotId: null,
  })
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT)
  const [editing, setEditing] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showSensor, setShowSensor] = useState(false)
  const [showActuator, setShowActuator] = useState(false)
  const [showScreen, setShowScreen] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showLifecycle, setShowLifecycle] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)

  const [cameraForm, setCameraForm] = useState<CameraForm>({
    cameraName: '',
    deviceNo: '',
    streamProtocol: 'rtmp',
    streamApp: 'live',
    streamName: '',
    rtmpPushUrl: '',
  })
  const [sensorForm, setSensorForm] = useState<SensorForm>({ sensorName: '', deviceNo: '', sensorType: '', category: 'soil', unit: '' })
  const [actuatorForm, setActuatorForm] = useState<ActuatorForm>({
    deviceName: '', deviceNo: '', deviceType: 'fertigation_machine', replaceDeviceId: '', replaceReason: '',
  })
  const [screenForm, setScreenForm] = useState<ScreenForm>({ screenName: '', deviceNo: '' })
  const [batchForm, setBatchForm] = useState<BatchForm>({ cropName: '', varietyName: '', growthStage: 'seedling', sowingAt: '', expectedHarvestAt: '' })

  // Result dialogs
  const [cameraResult, setCameraResult] = useState<{
    open: boolean
    deviceNo: string
    pushUrl: string
    streamName: string
    streamApp: string
    streamProtocol: string
  }>({
    open: false,
    deviceNo: '',
    pushUrl: '',
    streamName: '',
    streamApp: 'live',
    streamProtocol: 'rtmp',
  })
  const [sensorResult, setSensorResult] = useState<{ open: boolean; deviceNo: string; topic: string }>({ open: false, deviceNo: '', topic: '' })
  const [screenResult, setScreenResult] = useState<{ open: boolean; token: string }>({ open: false, token: '' })

  const lifecyclePlotId = activePlot?.plotId
  const { data: lifecycleDevices } = useQuery({
    queryKey: qk.devices.list({ plotId: lifecyclePlotId, pageNo: 1, pageSize: 100 }),
    queryFn: () => listDevices({ plotId: lifecyclePlotId, pageNo: 1, pageSize: 100 }),
    enabled: !!lifecyclePlotId && (showLifecycle || showActuator),
  })
  const { data: lifecycleSensors } = useQuery({
    queryKey: qk.sensors.list({ plotId: lifecyclePlotId, pageNo: 1, pageSize: 100 }),
    queryFn: () => listSensorDevices({ plotId: lifecyclePlotId, pageNo: 1, pageSize: 100 }),
    enabled: !!lifecyclePlotId && showLifecycle,
  })
  const sameTypeActuators = (lifecycleDevices?.list ?? []).filter(
    (d: any) => String(d.deviceType ?? '') === actuatorForm.deviceType,
  )

  async function handleCreate() {
    if (!createForm.plotName.trim()) return toast.warning('请填写地块名称')
    setCreating(true)
    try {
      await createPlot({
        plotName: createForm.plotName,
        plotNo: createForm.plotNo || undefined,
        farmName: createForm.farmName || undefined,
        parentId: createForm.parentId ? Number(createForm.parentId) : undefined,
        areaSize: createForm.areaSize ? Number(createForm.areaSize) : undefined,
        longitude: createForm.longitude ? Number(createForm.longitude) : undefined,
        latitude: createForm.latitude ? Number(createForm.latitude) : undefined,
        introText: createForm.introText || undefined,
      })
      toast.success('地块创建成功')
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      setQuery((q) => ({ ...q, pageNo: 1 }))
      queryClient.invalidateQueries({ queryKey: qk.plots.all() })
    } catch { /* interceptor */ } finally { setCreating(false) }
  }

  async function handleBindCamera() {
    if (!activePlot || !cameraForm.cameraName.trim()) return toast.warning('请填写摄像头名称')
    setSubmitting(true)
    try {
      const res: any = await bindCamera(activePlot.plotId, {
        cameraName: cameraForm.cameraName,
        deviceNo: cameraForm.deviceNo || undefined,
        streamProtocol: cameraForm.streamProtocol,
        streamApp: cameraForm.streamApp || undefined,
        streamName: cameraForm.streamName || undefined,
        rtmpPushUrl: cameraForm.rtmpPushUrl || undefined,
      })
      setShowCamera(false)
      setCameraResult({
        open: true,
        deviceNo: String(res?.deviceNo ?? ''),
        pushUrl: String(res?.rtmpPushUrl ?? ''),
        streamName: String(res?.streamName ?? cameraForm.streamName ?? ''),
        streamApp: String(res?.streamApp ?? cameraForm.streamApp ?? 'live'),
        streamProtocol: String(res?.streamProtocol ?? cameraForm.streamProtocol ?? 'rtmp'),
      })
      queryClient.invalidateQueries({ queryKey: qk.cameras.all() })
    } catch { /* interceptor */ } finally { setSubmitting(false) }
  }

  async function handleBindSensor() {
    if (!activePlot || !sensorForm.sensorName.trim()) return toast.warning('请填写传感器名称')
    if (!sensorForm.sensorType.trim()) return toast.warning('请填写传感器类型')
    setSubmitting(true)
    try {
      const res: any = await bindSensor(activePlot.plotId, {
        sensorName: sensorForm.sensorName,
        deviceNo: sensorForm.deviceNo || undefined,
        sensorType: sensorForm.sensorType,
        category: sensorForm.category,
        unit: sensorForm.unit || undefined,
      })
      setShowSensor(false)
      setSensorResult({ open: true, deviceNo: String(res?.deviceNo ?? ''), topic: String(res?.mqttTopic ?? '') })
      queryClient.invalidateQueries({ queryKey: qk.sensors.all() })
    } catch { /* interceptor */ } finally { setSubmitting(false) }
  }

  async function handleBindActuator() {
    if (!activePlot || !actuatorForm.deviceName.trim()) return toast.warning('请填写设备名称')
    if (sameTypeActuators.length > 0 && !actuatorForm.replaceDeviceId) {
      return toast.warning('该地块已有同类设备，请先选择要替换的设备')
    }
    setSubmitting(true)
    try {
      await bindActuator(activePlot.plotId, {
        deviceName: actuatorForm.deviceName,
        deviceNo: actuatorForm.deviceNo || undefined,
        deviceType: actuatorForm.deviceType,
        replaceDeviceId: actuatorForm.replaceDeviceId ? Number(actuatorForm.replaceDeviceId) : undefined,
        replaceReason: actuatorForm.replaceReason || undefined,
      })
      toast.success(actuatorForm.replaceDeviceId ? '设备更换成功' : '设备已绑定')
      setShowActuator(false)
      queryClient.invalidateQueries({ queryKey: qk.devices.all() })
    } catch (e: any) {
      toast.warning(e?.message || '绑定失败，请检查是否需要 replaceDeviceId')
    } finally { setSubmitting(false) }
  }

  async function handleBindScreen() {
    if (!activePlot || !screenForm.screenName.trim()) return toast.warning('请填写大屏名称')
    setSubmitting(true)
    try {
      const res: any = await bindScreen(activePlot.plotId, {
        screenName: screenForm.screenName,
        deviceNo: screenForm.deviceNo || undefined,
      })
      setShowScreen(false)
      setScreenResult({ open: true, token: String(res?.screenToken ?? '') })
      queryClient.invalidateQueries({ queryKey: qk.screens.all() })
    } catch { /* interceptor */ } finally { setSubmitting(false) }
  }

  async function handleCreateBatch() {
    if (!activePlot || !batchForm.cropName.trim()) return toast.warning('请填写作物名称')
    setSubmitting(true)
    try {
      await createCropBatch(activePlot.plotId, {
        cropName: batchForm.cropName,
        varietyName: batchForm.varietyName || undefined,
        growthStage: batchForm.growthStage,
        sowingAt: batchForm.sowingAt ? batchForm.sowingAt.replace('T', ' ') + ':00' : undefined,
        expectedHarvestAt: batchForm.expectedHarvestAt ? batchForm.expectedHarvestAt.replace('T', ' ') + ':00' : undefined,
      })
      toast.success('作物批次已创建')
      setShowBatch(false)
    } catch { /* interceptor */ } finally { setSubmitting(false) }
  }

  function copy(t: string) {
    navigator.clipboard.writeText(t).then(() => toast.success('已复制'))
  }

  /** PlotTree 的 onAction 派发 · 把树里的"详情/编辑/绑/治理/订单/批次"映射到对应 Dialog */
  function handleTreeAction(action: PlotTreeAction) {
    const p = action.plot
    setActivePlot(p)
    resetBindForms()
    switch (action.type) {
      case 'detail':
        openDetail(p)
        break
      case 'edit':
        openEdit(p)
        break
      case 'camera':
        setShowCamera(true)
        break
      case 'sensor':
        setShowSensor(true)
        break
      case 'actuator':
        setShowActuator(true)
        break
      case 'screen':
        setShowScreen(true)
        break
      case 'batch':
        setShowBatch(true)
        break
      case 'lifecycle':
        setShowLifecycle(true)
        break
      case 'order': {
        const name = String(p.plotName ?? p.name ?? '')
        const qs = new URLSearchParams({
          prefillPlotId: String(p.plotId),
          ...(name ? { prefillPlotName: name } : {}),
          openCreate: '1',
        })
        navigate(`/orders?${qs.toString()}`)
        break
      }
    }
  }

  function resetBindForms() {
    setCameraForm({
      cameraName: '',
      deviceNo: '',
      streamProtocol: 'rtmp',
      streamApp: 'live',
      streamName: '',
      rtmpPushUrl: '',
    })
    setSensorForm({ sensorName: '', deviceNo: '', sensorType: '', category: 'soil', unit: '' })
    setActuatorForm({ deviceName: '', deviceNo: '', deviceType: 'fertigation_machine', replaceDeviceId: '', replaceReason: '' })
    setScreenForm({ screenName: '', deviceNo: '' })
    setBatchForm({ cropName: '', varietyName: '', growthStage: 'seedling', sowingAt: '', expectedHarvestAt: '' })
  }

  // 打开详情 · 先放 row snapshot, 再拉 fresh detail 覆盖
  async function openDetail(row: Plot) {
    setDetailDlg({ open: true, plot: row, loading: true })
    try {
      const fresh = await getPlotDetail(row.plotId)
      setDetailDlg({ open: true, plot: { ...row, ...fresh }, loading: false })
    } catch {
      setDetailDlg((prev) => ({ ...prev, loading: false }))
    }
  }

  // 开启编辑 · 从当前 detail 预填表单
  function openEdit(plot: Plot) {
    const p = plot as Plot & {
      plotName?: string
      areaSize?: number | string
      areaUnit?: string
      longitude?: number | string
      latitude?: number | string
      plotStatus?: string
      liveCoverUrl?: string
      introText?: string
    }
    setEditForm({
      plotName: String(p.plotName ?? p.name ?? ''),
      areaSize: p.areaSize != null ? String(p.areaSize) : '',
      areaUnit: String(p.areaUnit ?? 'mu'),
      longitude: p.longitude != null ? String(p.longitude) : '',
      latitude: p.latitude != null ? String(p.latitude) : '',
      plotStatus: String(p.plotStatus ?? 'active'),
      liveCoverUrl: String(p.liveCoverUrl ?? ''),
      introText: String(p.introText ?? ''),
    })
    setEditDlg({ open: true, plotId: plot.plotId })
  }

  async function handleUpdatePlot() {
    if (!editDlg.plotId) return
    if (!editForm.plotName.trim()) return toast.warning('地块名称不能为空')
    const hasLng = editForm.longitude.trim() !== ''
    const hasLat = editForm.latitude.trim() !== ''
    if (hasLng !== hasLat) return toast.warning('经度和纬度必须同时填写')
    setEditing(true)
    try {
      const payload: Record<string, unknown> = {
        plotName: editForm.plotName.trim(),
        plotStatus: editForm.plotStatus,
      }
      if (editForm.areaSize.trim()) payload.areaSize = Number(editForm.areaSize)
      if (editForm.areaUnit) payload.areaUnit = editForm.areaUnit
      if (hasLng) payload.longitude = Number(editForm.longitude)
      if (hasLat) payload.latitude = Number(editForm.latitude)
      if (editForm.liveCoverUrl.trim()) payload.liveCoverUrl = editForm.liveCoverUrl.trim()
      if (editForm.introText.trim()) payload.introText = editForm.introText.trim()

      const fresh = await updatePlot(editDlg.plotId, payload)
      toast.success('地块已更新')
      setEditDlg({ open: false, plotId: null })
      // 详情弹窗同步刷新
      setDetailDlg((prev) => prev.plot && prev.plot.plotId === editDlg.plotId
        ? { ...prev, plot: { ...prev.plot, ...fresh } }
        : prev,
      )
      queryClient.invalidateQueries({ queryKey: qk.plots.all() })
    } catch {
      // interceptor 已 toast
    } finally {
      setEditing(false)
    }
  }

  async function handleRetireActuator(deviceId: number, deviceName: string) {
    const reason = window.prompt(`停用执行设备「${deviceName}」原因（必填）:`)?.trim()
    if (!reason) return
    setLifecycleBusy(true)
    try {
      await retireActuatorDevice(deviceId, { reason })
      toast.success('执行设备已停用')
      queryClient.invalidateQueries({ queryKey: qk.devices.all() })
    } catch { /* interceptor */ } finally { setLifecycleBusy(false) }
  }

  async function handleRetireSensor(sensorId: number, sensorName: string) {
    const reason = window.prompt(`停用传感器「${sensorName}」原因（必填）:`)?.trim()
    if (!reason) return
    setLifecycleBusy(true)
    try {
      await retireSensorDevice(sensorId, { reason })
      toast.success('传感器已停用')
      queryClient.invalidateQueries({ queryKey: qk.sensors.all() })
    } catch { /* interceptor */ } finally { setLifecycleBusy(false) }
  }

  return (
    <PageShell
      seal="§5 · Land"
      title="Plots"
      titleCn="地 块"
      lede="The soil under our devices. Where crops quietly grow."
      right={<><span>{total} ENTRIES</span><span>·</span><span>PAGE {String(query.pageNo).padStart(2, '0')}</span></>}
    >
      {/* Filter + Create · Pattern B (对齐 OrdersPage/UsersPage/CodesPage) · 强制横排不折行 */}
      <section
        className="folio-page__section flex !flex-row flex-wrap items-end justify-between gap-3"
        data-testid="plots-filter"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plots-filter-parent">GREENHOUSE</Label>
            <Select
              value={query.parentId || ALL}
              onValueChange={(v) => setQuery((q) => ({ ...q, parentId: v === ALL ? '' : v, pageNo: 1 }))}
            >
              <SelectTrigger id="plots-filter-parent" className="w-[200px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部 · All</SelectItem>
                {greenhouses.map((g) => (
                  <SelectItem key={g.plotId} value={String(g.plotId)}>{String(g.plotName ?? g.name ?? g.plotId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plots-filter-status">STATUS</Label>
            <Select
              value={query.plotStatus || ALL}
              onValueChange={(v) => setQuery((q) => ({ ...q, plotStatus: v === ALL ? '' : v, pageNo: 1 }))}
            >
              <SelectTrigger id="plots-filter-status" className="w-[160px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部 · All</SelectItem>
                <SelectItem value="active">激活 · active</SelectItem>
                <SelectItem value="fallow">休耕 · fallow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button variant="primary" data-testid="plots-create-trigger">+ 新建地块</Button>
          </DialogTrigger>
          <DialogContent className="w-[min(560px,calc(100vw-32px))]">
            <DialogHeader>
              <DialogSeal>§ FORM · new plot</DialogSeal>
              <DialogTitle>新建地块</DialogTitle>
              <DialogDescription>Register a greenhouse or a sub-plot.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label htmlFor="plot-name">NAME *</Label>
                  <Input id="plot-name" value={createForm.plotName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plotName: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-no">PLOT NO.</Label>
                  <Input id="plot-no" value={createForm.plotNo}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plotNo: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-parent">PARENT</Label>
                  <Select
                    value={createForm.parentId || ALL}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, parentId: v === ALL ? '' : v }))}
                  >
                    <SelectTrigger id="plot-parent"><SelectValue placeholder="greenhouse level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>none · 大棚级</SelectItem>
                      {greenhouses.map((g) => (
                        <SelectItem key={g.plotId} value={String(g.plotId)}>{String(g.plotName ?? g.plotId)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-farm">FARM</Label>
                  <Input id="plot-farm" value={createForm.farmName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, farmName: e.target.value }))}
                    disabled={!!createForm.parentId}
                    placeholder={createForm.parentId ? 'inherit from parent' : ''} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-area">AREA</Label>
                  <Input id="plot-area" type="number" step="0.01" min={0} value={createForm.areaSize}
                    onChange={(e) => setCreateForm((f) => ({ ...f, areaSize: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-lng">LONGITUDE</Label>
                  <Input id="plot-lng" type="number" step="0.000001" value={createForm.longitude}
                    onChange={(e) => setCreateForm((f) => ({ ...f, longitude: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plot-lat">LATITUDE</Label>
                  <Input id="plot-lat" type="number" step="0.000001" value={createForm.latitude}
                    onChange={(e) => setCreateForm((f) => ({ ...f, latitude: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label htmlFor="plot-intro">INTRO</Label>
                  <Input id="plot-intro" value={createForm.introText}
                    onChange={(e) => setCreateForm((f) => ({ ...f, introText: e.target.value }))} />
                </div>
                {/* §HINT · 大棚级 (parentId 为空) 必须再绑至少 1 个子点位才能在大屏 GreenhouseSwitcher 显示 */}
                {!createForm.parentId && (
                  <div className="col-span-2 border-l-2 border-line-soft pl-3 py-1 text-[11px] font-folio text-ink-soft leading-relaxed">
                    <span className="text-clay">·</span> 大棚级地块需要再绑至少 1 个<strong>子点位</strong>(选 PARENT 为本大棚)才会出现在大屏的 GreenhouseSwitcher · 后端 ScreenServiceImpl#getGreenhouses 会过滤掉空大棚.
                  </div>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
              <Button variant="primary" onClick={handleCreate} disabled={creating} data-testid="plots-create-submit">
                {creating ? '提交中...' : '提交'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="folio-page__section" data-testid="plots-table">
        <Card className="p-0">
          <PlotTree
            list={list}
            allPlots={plots}
            loading={loading}
            onAction={handleTreeAction}
          />
          <div className="px-4 pt-2 pb-3">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 10} total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>

      {/* Bind Camera */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="w-[min(480px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ BIND · camera</DialogSeal>
            <DialogTitle>绑定摄像头到地块</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>CAMERA NAME *</Label>
                <Input value={cameraForm.cameraName} onChange={(e) => setCameraForm((f) => ({ ...f, cameraName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE NO.</Label>
                <Input
                  value={cameraForm.deviceNo}
                  onChange={(e) => setCameraForm((f) => ({ ...f, deviceNo: e.target.value }))}
                  placeholder="留空则自动生成 · 如 cam_demo_001"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>PROTOCOL</Label>
                  <Select value={cameraForm.streamProtocol} onValueChange={(v) => setCameraForm((f) => ({ ...f, streamProtocol: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rtmp">RTMP</SelectItem>
                      <SelectItem value="rtsp">RTSP</SelectItem>
                      <SelectItem value="hls">HLS</SelectItem>
                      <SelectItem value="webrtc">WebRTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>STREAM APP</Label>
                  <Input
                    value={cameraForm.streamApp}
                    onChange={(e) => setCameraForm((f) => ({ ...f, streamApp: e.target.value }))}
                    placeholder="live"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>STREAM NAME</Label>
                <Input
                  value={cameraForm.streamName}
                  onChange={(e) => setCameraForm((f) => ({ ...f, streamName: e.target.value }))}
                  placeholder="留空将用 deviceNo · 如 cam_demo_001"
                />
                <span className="font-sans text-[11px] text-ink-faint">
                  SRS 流名 · 与 ffmpeg / 摄像头推流的 rtmp://.../live/<b>{'<streamName>'}</b> 一致
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>RTMP PUSH URL</Label>
                <Input
                  value={cameraForm.rtmpPushUrl}
                  onChange={(e) => setCameraForm((f) => ({ ...f, rtmpPushUrl: e.target.value }))}
                  placeholder="留空后端按 rtmp-base + app + name 自动拼"
                />
                <span className="font-sans text-[11px] text-ink-faint">
                  通常留空, 后端会拼出 <code className="font-folio">rtmp://localhost:1935/live/{'<streamName>'}</code> 给摄像头/ffmpeg 用
                </span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleBindCamera} disabled={submitting} data-testid="plots-bind-camera-submit">
              {submitting ? '绑定中...' : '绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bind Actuator */}
      <Dialog open={showActuator} onOpenChange={setShowActuator}>
        <DialogContent className="w-[min(480px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ BIND · actuator</DialogSeal>
            <DialogTitle>绑定执行设备到地块</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE NAME *</Label>
                <Input value={actuatorForm.deviceName} onChange={(e) => setActuatorForm((f) => ({ ...f, deviceName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE NO.</Label>
                <Input value={actuatorForm.deviceNo} onChange={(e) => setActuatorForm((f) => ({ ...f, deviceNo: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE TYPE *</Label>
                <Select value={actuatorForm.deviceType} onValueChange={(v) => setActuatorForm((f) => ({ ...f, deviceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="irrigator">浇水器 · irrigator</SelectItem>
                    <SelectItem value="fertilizer">施肥器 · fertilizer</SelectItem>
                    <SelectItem value="sprayer">喷淋器 · sprayer</SelectItem>
                    <SelectItem value="fertigation_machine">水肥一体机</SelectItem>
                    <SelectItem value="shade_controller">遮阳帘控制器</SelectItem>
                    <SelectItem value="wet_curtain_controller">湿帘控制器</SelectItem>
                    <SelectItem value="ventilation_fan_controller">换气扇控制器</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sameTypeActuators.length > 0 ? (
                <>
                  <div className="rounded border border-clay/40 bg-clay/10 px-3 py-2 text-[12px] text-clay">
                    当前地块已存在同类设备，必须选择要替换的旧设备。
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>REPLACE DEVICE *</Label>
                    <Select
                      value={actuatorForm.replaceDeviceId || ALL}
                      onValueChange={(v) => setActuatorForm((f) => ({ ...f, replaceDeviceId: v === ALL ? '' : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="选择要替换的设备" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>请选择</SelectItem>
                        {sameTypeActuators.map((d: any) => (
                          <SelectItem key={d.deviceId} value={String(d.deviceId)}>
                            {String(d.deviceName ?? d.deviceNo ?? d.deviceId)} · {String(d.deviceNo ?? '—')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>REPLACE REASON</Label>
                    <Input
                      value={actuatorForm.replaceReason}
                      onChange={(e) => setActuatorForm((f) => ({ ...f, replaceReason: e.target.value }))}
                      placeholder="例: 旧设备故障，执行更换"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleBindActuator} disabled={submitting}>
              {submitting ? '绑定中...' : '绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bind Sensor */}
      <Dialog open={showSensor} onOpenChange={setShowSensor}>
        <DialogContent className="w-[min(480px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ BIND · sensor</DialogSeal>
            <DialogTitle>绑定传感器到地块</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>SENSOR NAME *</Label>
                <Input value={sensorForm.sensorName} onChange={(e) => setSensorForm((f) => ({ ...f, sensorName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE NO.</Label>
                <Input value={sensorForm.deviceNo} onChange={(e) => setSensorForm((f) => ({ ...f, deviceNo: e.target.value }))} placeholder="auto if empty" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CATEGORY *</Label>
                <Select value={sensorForm.category} onValueChange={(v) => setSensorForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="environment">环境传感器 · 温湿度/光照/CO2</SelectItem>
                    <SelectItem value="soil">土壤传感器 · NPK/pH/土温土湿</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>SENSOR TYPE *</Label>
                <Input value={sensorForm.sensorType} onChange={(e) => setSensorForm((f) => ({ ...f, sensorType: e.target.value }))} placeholder="env_multi / soil_npk / soil_ph / soil_th" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>UNIT</Label>
                <Input value={sensorForm.unit} onChange={(e) => setSensorForm((f) => ({ ...f, unit: e.target.value }))} placeholder="%, ℃, lux ..." />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleBindSensor} disabled={submitting}>
              {submitting ? '绑定中...' : '绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Lifecycle */}
      <Dialog open={showLifecycle} onOpenChange={setShowLifecycle}>
        <DialogContent className="w-[min(760px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ GOVERN · lifecycle</DialogSeal>
            <DialogTitle>设备治理（停用/更换）</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-line-soft p-3">
                <div className="font-folio text-[11px] uppercase tracking-widest text-ink-faint mb-2">执行设备</div>
                <div className="flex flex-col gap-2 max-h-[320px] overflow-auto pr-1">
                  {(lifecycleDevices?.list ?? []).length === 0 ? (
                    <div className="text-[12px] text-ink-faint">暂无执行设备</div>
                  ) : (lifecycleDevices?.list ?? []).map((d: any) => (
                    <div key={d.deviceId} className="flex items-center gap-2 border border-line-soft px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink truncate">{String(d.deviceName ?? '—')}</div>
                        <div className="font-folio text-[10px] text-ink-faint">{String(d.deviceType ?? '')} · {String(d.deviceNo ?? '')}</div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={lifecycleBusy}
                        onClick={() => handleRetireActuator(Number(d.deviceId), String(d.deviceName ?? d.deviceNo ?? d.deviceId))}
                      >
                        停用
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-line-soft p-3">
                <div className="font-folio text-[11px] uppercase tracking-widest text-ink-faint mb-2">传感器</div>
                <div className="flex flex-col gap-2 max-h-[320px] overflow-auto pr-1">
                  {(lifecycleSensors?.list ?? []).length === 0 ? (
                    <div className="text-[12px] text-ink-faint">暂无传感器</div>
                  ) : (lifecycleSensors?.list ?? []).map((s: any) => (
                    <div key={s.sensorId} className="flex items-center gap-2 border border-line-soft px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-ink truncate">{String(s.sensorName ?? '—')}</div>
                        <div className="font-folio text-[10px] text-ink-faint">{String(s.sensorType ?? '')} · {String(s.deviceNo ?? '')}</div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={lifecycleBusy}
                        onClick={() => handleRetireSensor(Number(s.sensorId), String(s.sensorName ?? s.deviceNo ?? s.sensorId))}
                      >
                        停用
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">关闭</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bind Screen */}
      <Dialog open={showScreen} onOpenChange={setShowScreen}>
        <DialogContent className="w-[min(480px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ BIND · screen</DialogSeal>
            <DialogTitle>绑定大屏到地块</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>SCREEN NAME *</Label>
                <Input value={screenForm.screenName} onChange={(e) => setScreenForm((f) => ({ ...f, screenName: e.target.value }))} placeholder="1号大棚展示屏" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DEVICE NO.</Label>
                <Input value={screenForm.deviceNo} onChange={(e) => setScreenForm((f) => ({ ...f, deviceNo: e.target.value }))} placeholder="auto if empty" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleBindScreen} disabled={submitting}>
              {submitting ? '绑定中...' : '绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Batch */}
      <Dialog open={showBatch} onOpenChange={setShowBatch}>
        <DialogContent className="w-[min(480px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ BATCH · new</DialogSeal>
            <DialogTitle>创建作物批次</DialogTitle>
            <DialogDescription>{String(activePlot?.plotName ?? '')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>CROP NAME *</Label>
                <Input value={batchForm.cropName} onChange={(e) => setBatchForm((f) => ({ ...f, cropName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>VARIETY</Label>
                <Input value={batchForm.varietyName} onChange={(e) => setBatchForm((f) => ({ ...f, varietyName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>GROWTH STAGE</Label>
                <Select value={batchForm.growthStage} onValueChange={(v) => setBatchForm((f) => ({ ...f, growthStage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seedling">播种期</SelectItem>
                    <SelectItem value="growing">生长期</SelectItem>
                    <SelectItem value="mature">成熟期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>SOWING AT</Label>
                  <Input type="datetime-local" value={batchForm.sowingAt} onChange={(e) => setBatchForm((f) => ({ ...f, sowingAt: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>HARVEST AT</Label>
                  <Input type="datetime-local" value={batchForm.expectedHarvestAt} onChange={(e) => setBatchForm((f) => ({ ...f, expectedHarvestAt: e.target.value }))} />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button variant="primary" onClick={handleCreateBatch} disabled={submitting}>
              {submitting ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Result */}
      <Dialog open={cameraResult.open} onOpenChange={(open) => setCameraResult((r) => ({ ...r, open }))}>
        <DialogContent className="w-[min(620px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ RESULT · camera bound</DialogSeal>
            <DialogTitle>摄像头绑定成功</DialogTitle>
            <DialogDescription>把以下推流配置告知现场硬件师傅。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <HardwarePushGuide
              deviceNo={cameraResult.deviceNo}
              streamProtocol={cameraResult.streamProtocol}
              rtmpPushUrl={cameraResult.pushUrl}
              streamName={cameraResult.streamName}
              streamApp={cameraResult.streamApp}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">关闭 Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sensor Result */}
      <Dialog open={sensorResult.open} onOpenChange={(open) => setSensorResult((r) => ({ ...r, open }))}>
        <DialogContent className="w-[min(520px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ RESULT · sensor bound</DialogSeal>
            <DialogTitle>传感器绑定成功</DialogTitle>
            <DialogDescription>MQTT topic 已分配, 请给硬件师。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-2">
              <div className="font-folio text-[11px] text-ink-faint">DEVICE NO.</div>
              <div className="font-folio text-ink">{sensorResult.deviceNo}</div>
              <div className="font-folio text-[11px] text-ink-faint mt-2">MQTT TOPIC</div>
              <div className="font-folio text-[12px] text-ink break-all border border-line-soft px-3 py-2 bg-paper">
                {sensorResult.topic}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => copy(sensorResult.topic)}>复制</Button>
            <DialogClose asChild><Button variant="ghost">关闭</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screen Result */}
      <Dialog open={screenResult.open} onOpenChange={(open) => setScreenResult((r) => ({ ...r, open }))}>
        <DialogContent className="w-[min(520px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ RESULT · screen token</DialogSeal>
            <DialogTitle>大屏绑定成功</DialogTitle>
            <DialogDescription>请将 Token 配置到大屏浏览器。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[12px] text-ink break-all border border-line-soft px-3 py-2 bg-paper">
              {screenResult.token}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => copy(screenResult.token)}>复制 Token</Button>
            <DialogClose asChild><Button variant="ghost">关闭</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 地块详情 · row snapshot + fresh GET /admin/plots/{id} 合并 */}
      <Dialog
        open={detailDlg.open}
        onOpenChange={(open) => {
          if (!open) setDetailDlg({ open: false, plot: null, loading: false })
        }}
      >
        <DialogContent className="w-[min(560px,calc(100vw-32px))]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · plot</DialogSeal>
            <DialogTitle>地块详情</DialogTitle>
            <DialogDescription>
              Folio record merged from list snapshot and GET /admin/plots/&#123;id&#125;.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailDlg.plot ? (() => {
              const p = detailDlg.plot as Plot & {
                plotNo?: string
                plotName?: string
                parentId?: number | null
                parentName?: string | null
                farmId?: number | null
                farmName?: string | null
                areaSize?: number | string
                areaUnit?: string
                longitude?: number | string
                latitude?: number | string
                plotStatus?: string
                liveCoverUrl?: string
                introText?: string
                createdAt?: string
                updatedAt?: string
              }
              const isGreenhouse = !p.parentId
              return (
                <dl className="grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plotId</dt>
                  <dd className="font-folio text-ink">
                    {p.plotId}
                    {detailDlg.loading ? (
                      <span className="font-folio text-[11px] text-ink-faint ml-2">refreshing…</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plotNo</dt>
                  <dd className="font-folio text-[12px] text-ink">{String(p.plotNo ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">name</dt>
                  <dd className="text-ink">{String(p.plotName ?? p.name ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">kind</dt>
                  <dd>
                    <Badge tone={isGreenhouse ? 'sand' : 'neutral'}>
                      {isGreenhouse ? '大棚' : '点位'}
                    </Badge>
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">parent</dt>
                  <dd className="text-ink">
                    {p.parentId ? (
                      <>
                        <span>{String(p.parentName ?? '—')}</span>
                        <span className="font-folio text-[11px] text-ink-faint ml-2">#{p.parentId}</span>
                      </>
                    ) : <span className="text-ink-faint">无 (大棚级)</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">farm</dt>
                  <dd className="text-ink">
                    {p.farmName ? (
                      <>
                        <span>{String(p.farmName)}</span>
                        {p.farmId ? (
                          <span className="font-folio text-[11px] text-ink-faint ml-2">#{p.farmId}</span>
                        ) : null}
                      </>
                    ) : <span className="text-ink-faint">—</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">area</dt>
                  <dd className="font-folio text-ink">
                    {p.areaSize != null ? <>{String(p.areaSize)} <span className="text-ink-faint">{String(p.areaUnit ?? '')}</span></> : '—'}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">longitude</dt>
                  <dd className="font-folio text-[12px] text-ink">{p.longitude != null ? String(p.longitude) : <span className="text-ink-faint">—</span>}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">latitude</dt>
                  <dd className="font-folio text-[12px] text-ink">{p.latitude != null ? String(p.latitude) : <span className="text-ink-faint">—</span>}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">status</dt>
                  <dd>
                    <Badge tone={String(p.plotStatus) === 'active' ? 'sage' : 'neutral'}>
                      {String(p.plotStatus) === 'active' ? '使用中' : String(p.plotStatus ?? '—')}
                    </Badge>
                  </dd>
                  {p.liveCoverUrl ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">cover</dt>
                      <dd className="font-folio text-[12px] text-ink break-all">{String(p.liveCoverUrl)}</dd>
                    </>
                  ) : null}
                  {p.introText ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">intro</dt>
                      <dd className="text-ink break-all">{String(p.introText)}</dd>
                    </>
                  ) : null}
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(p.createdAt ?? '—')}</dd>
                  {p.updatedAt ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">updatedAt</dt>
                      <dd className="font-folio text-[12px] text-ink-soft">{String(p.updatedAt)}</dd>
                    </>
                  ) : null}
                </dl>
              )
            })() : null}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="primary"
              disabled={!detailDlg.plot}
              onClick={() => {
                if (!detailDlg.plot) return
                const p = detailDlg.plot
                setDetailDlg({ open: false, plot: null, loading: false })
                openEdit(p)
              }}
              data-testid="plots-detail-edit"
            >
              编辑 Edit
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">关闭 Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑地块 · PUT /admin/plots/{id} · 部分字段更新 */}
      <Dialog
        open={editDlg.open}
        onOpenChange={(open) => setEditDlg((d) => ({ ...d, open }))}
      >
        <DialogContent className="w-[min(560px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ FORM · edit plot</DialogSeal>
            <DialogTitle>编辑地块</DialogTitle>
            <DialogDescription>
              plotNo / parentId / farmId 不允许改；经纬度要么都填要么都不填。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="edit-plot-name">NAME *</Label>
                <Input
                  id="edit-plot-name"
                  value={editForm.plotName}
                  onChange={(e) => setEditForm((f) => ({ ...f, plotName: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-plot-area">AREA</Label>
                <Input
                  id="edit-plot-area"
                  type="number"
                  step="0.01"
                  min={0}
                  value={editForm.areaSize}
                  onChange={(e) => setEditForm((f) => ({ ...f, areaSize: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-plot-unit">UNIT</Label>
                <Select
                  value={editForm.areaUnit}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, areaUnit: v }))}
                >
                  <SelectTrigger id="edit-plot-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mu">亩 · mu</SelectItem>
                    <SelectItem value="hectare">公顷 · hectare</SelectItem>
                    <SelectItem value="m2">m²</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-plot-lng">LONGITUDE</Label>
                <Input
                  id="edit-plot-lng"
                  type="number"
                  step="0.000001"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-plot-lat">LATITUDE</Label>
                <Input
                  id="edit-plot-lat"
                  type="number"
                  step="0.000001"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="edit-plot-status">STATUS</Label>
                <Select
                  value={editForm.plotStatus}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, plotStatus: v }))}
                >
                  <SelectTrigger id="edit-plot-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">激活 · active</SelectItem>
                    <SelectItem value="fallow">休耕 · fallow</SelectItem>
                    <SelectItem value="inactive">停用 · inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="edit-plot-cover">COVER URL</Label>
                <Input
                  id="edit-plot-cover"
                  value={editForm.liveCoverUrl}
                  onChange={(e) => setEditForm((f) => ({ ...f, liveCoverUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="edit-plot-intro">INTRO</Label>
                <Input
                  id="edit-plot-intro"
                  value={editForm.introText}
                  onChange={(e) => setEditForm((f) => ({ ...f, introText: e.target.value }))}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button
              variant="primary"
              onClick={handleUpdatePlot}
              disabled={editing}
              data-testid="plots-edit-submit"
            >
              {editing ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
