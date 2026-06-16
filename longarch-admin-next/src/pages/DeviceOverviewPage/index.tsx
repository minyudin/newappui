import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/shell/PageShell'
import {
  Badge, Button, Card, CardContent, CardHeader, CardSeal, CardTitle, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui'
import { getDeviceOverview, getPlotSensorOverview, listPlots, listSensorDevices } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import type { PageQuery } from '@/types/api'

/**
 * §6 DeviceOverview · 设备状态总览
 * 对齐 longarch-admin/src/views/DeviceOverview.vue
 */

const DEVICE_TYPE_LABEL: Record<string, string> = {
  camera: '摄像头',
  sensor: '传感器',
  actuator: '执行设备',
  screen: '大屏',
}

interface DeviceStat { deviceType: string; total: number; online: number; registered: number; offline: number }
interface Overview { totalPlots: number; deviceStats: DeviceStat[] }
interface PlotSensor {
  sensorId: number; sensorName: string; deviceNo: string; status: string
  lastSampleAt?: string; metrics?: Record<string, unknown>
}
interface PlotOverviewData {
  plotId: number | null; plotName: string; updatedAt: string
  environment: PlotSensor[]; soil: PlotSensor[]
}

const ALL = '__all__'
const EMPTY_PLOT: PlotOverviewData = { plotId: null, plotName: '', updatedAt: '', environment: [], soil: [] }

export default function DeviceOverviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedPlotId, setSelectedPlotId] = useState<string>('')
  const [query, setQuery] = useState<PageQuery & { plotId: string; category: string }>({
    pageNo: 1, pageSize: 10, plotId: '', category: '',
  })

  // 设备总览 · 实时型 (15s refetch)
  const { data: overviewData } = useQuery({
    queryKey: qk.devices.overview(),
    queryFn: () => getDeviceOverview() as Promise<any>,
    staleTime: STALE.LIVE,
    refetchInterval: REFETCH.LIVE,
  })
  const overview: Overview = {
    totalPlots: overviewData?.totalPlots ?? 0,
    deviceStats: overviewData?.deviceStats ?? [],
  }

  // 下拉地块全量 · 配置型
  const plotsParams = { pageNo: 1, pageSize: 100 }
  const { data: plotsData } = useQuery({
    queryKey: qk.plots.list(plotsParams),
    queryFn: () => listPlots(plotsParams),
  })
  const plots = plotsData?.list ?? []

  // 当前选中地块的传感器总览 · 实时型 (15s refetch)
  const { data: plotOverviewData } = useQuery({
    queryKey: qk.plots.overview(selectedPlotId),
    queryFn: () => getPlotSensorOverview(selectedPlotId) as Promise<any>,
    enabled: !!selectedPlotId,
    staleTime: STALE.LIVE,
    refetchInterval: REFETCH.LIVE,
  })
  const plotOverview: PlotOverviewData = plotOverviewData
    ? {
        plotId: plotOverviewData.plotId ?? null,
        plotName: String(plotOverviewData.plotName ?? ''),
        environment: (plotOverviewData.environment ?? []) as PlotSensor[],
        soil: (plotOverviewData.soil ?? []) as PlotSensor[],
        updatedAt: String(plotOverviewData.updatedAt ?? ''),
      }
    : EMPTY_PLOT

  // 传感器注册表 · 实时型 (15s refetch)
  const sensorsParams: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.plotId) sensorsParams.plotId = query.plotId
  if (query.category) sensorsParams.category = query.category
  const { data: sensorsData, isPending: sensorLoading } = useQuery({
    queryKey: qk.sensors.list(sensorsParams),
    queryFn: () => listSensorDevices(sensorsParams),
    staleTime: STALE.LIVE,
    refetchInterval: REFETCH.LIVE,
  })
  const sensorList = sensorsData?.list ?? []
  const sensorTotal = sensorsData?.total ?? 0

  function goHistory(s: { sensorId: number; sensorName?: string; deviceNo?: string }) {
    const params = new URLSearchParams({
      sensorId: String(s.sensorId),
      sensorName: String(s.sensorName ?? ''),
      deviceNo: String(s.deviceNo ?? ''),
    })
    navigate(`/sensor-data?${params.toString()}`)
  }

  return (
    <PageShell
      seal="§6 · Devices"
      title="Device Overview"
      titleCn="设 备 总 览"
      lede="Every sensor and actuator, listed on one page."
      right={<Button variant="ghost" size="sm" onClick={() => {
        queryClient.invalidateQueries({ queryKey: qk.devices.overview() })
        queryClient.invalidateQueries({ queryKey: qk.sensors.all() })
      }}>REFRESH</Button>}
    >
      {/* KPI */}
      <section className="folio-page__section" data-testid="overview-kpi">
        <h4 className="folio-page__section-title">§6.1 <em>Device counts</em></h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="py-2 px-3 gap-0"><CardSeal>§ · Plots</CardSeal></CardHeader>
            <CardContent className="px-3 py-3">
              <div className="font-serif text-[28px] leading-none text-ink">{overview.totalPlots}</div>
              <div className="mt-1 font-sans text-[12px] text-ink-soft">地块总数</div>
            </CardContent>
          </Card>
          {overview.deviceStats.map((s) => (
            <Card key={s.deviceType}>
              <CardHeader className="py-2 px-3 gap-0">
                <CardSeal>§ · {s.deviceType}</CardSeal>
              </CardHeader>
              <CardContent className="px-3 py-3 flex flex-col gap-2">
                <div className="font-serif text-[28px] leading-none text-ink">{s.total}</div>
                <div className="font-sans text-[12px] text-ink-soft">{DEVICE_TYPE_LABEL[s.deviceType] ?? s.deviceType}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone="sage">在线 {s.online}</Badge>
                  <Badge tone="neutral">注册 {s.registered}</Badge>
                  <Badge tone="clay">离线 {s.offline}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Plot selector + groups */}
      <section className="folio-page__section" data-testid="overview-plot">
        <h4 className="folio-page__section-title">§6.2 <em>Per-plot sensor data</em></h4>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="overview-plot-pick">PLOT</Label>
            <Select value={selectedPlotId || ALL} onValueChange={(v) => setSelectedPlotId(v === ALL ? '' : v)}>
              <SelectTrigger id="overview-plot-pick" className="w-[260px]"><SelectValue placeholder="pick a plot" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>none · 未选择</SelectItem>
                {plots.map((p) => (
                  <SelectItem key={p.plotId} value={String(p.plotId)}>{String(p.plotName ?? p.plotId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {plotOverview.plotId && (
            <div className="font-folio text-[11px] text-ink-faint tracking-widest">
              {plotOverview.plotName} · updated {plotOverview.updatedAt}
            </div>
          )}
        </div>

        {plotOverview.plotId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <Card>
              <CardHeader>
                <CardSeal>§ α · environment</CardSeal>
                <CardTitle>环境传感器</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {plotOverview.environment.length === 0 && (
                  <div className="font-serif italic text-[13px] text-ink-faint">No environment sensors.</div>
                )}
                {plotOverview.environment.map((s) => (
                  <div key={s.sensorId} className="border border-line-soft p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge tone={s.status === 'online' ? 'sage' : 'clay'}>{s.status}</Badge>
                      <span className="font-sans text-[14px] text-ink">{s.sensorName}</span>
                      <span className="font-folio text-[11px] text-ink-faint">{s.deviceNo}</span>
                      <Button variant="link" size="sm" className="ml-auto" onClick={() => goHistory(s)}>历史</Button>
                    </div>
                    {s.metrics && Object.keys(s.metrics).length ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.metrics).map(([k, v]) => (
                          <div key={k} className="flex flex-col items-center border border-line-soft bg-paper px-3 py-1.5">
                            <span className="font-folio text-[10px] text-ink-faint">{k}</span>
                            <span className="font-folio text-[14px] text-ink">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-serif italic text-[12px] text-ink-faint">No data yet.</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardSeal>§ β · soil</CardSeal>
                <CardTitle>土壤传感器</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {plotOverview.soil.length === 0 && (
                  <div className="font-serif italic text-[13px] text-ink-faint">No soil sensors.</div>
                )}
                {plotOverview.soil.map((s) => (
                  <div key={s.sensorId} className="border border-line-soft p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge tone={s.status === 'online' ? 'sage' : 'clay'}>{s.status}</Badge>
                      <span className="font-sans text-[14px] text-ink">{s.sensorName}</span>
                      <Button variant="link" size="sm" className="ml-auto" onClick={() => goHistory(s)}>历史</Button>
                    </div>
                    <div className="font-folio text-[11px] text-ink-faint mb-2">{s.deviceNo}</div>
                    {s.metrics && Object.keys(s.metrics).length ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.metrics).map(([k, v]) => (
                          <div key={k} className="flex flex-col items-center border border-line-soft bg-paper px-3 py-1.5">
                            <span className="font-folio text-[10px] text-ink-faint">{k}</span>
                            <span className="font-folio text-[14px] text-ink">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-serif italic text-[12px] text-ink-faint">No data yet.</div>
                    )}
                    {s.lastSampleAt && (
                      <div className="font-folio text-[10px] text-ink-faint mt-2">last · {s.lastSampleAt}</div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="mt-2 py-10 text-center font-serif italic text-[13px] text-ink-faint border border-dashed border-line">
            Pick a plot above to inspect its sensors.
          </div>
        )}
      </section>

      {/* Sensor list */}
      <section className="folio-page__section" data-testid="overview-sensors">
        <h4 className="folio-page__section-title">§6.3 <em>Sensor devices registry</em></h4>
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sens-filter-plot">PLOT</Label>
            <Select value={query.plotId || ALL} onValueChange={(v) => setQuery((q) => ({ ...q, plotId: v === ALL ? '' : v, pageNo: 1 }))}>
              <SelectTrigger id="sens-filter-plot" className="w-[200px]"><SelectValue placeholder="All plots" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部 · All plots</SelectItem>
                {plots.map((p) => (
                  <SelectItem key={p.plotId} value={String(p.plotId)}>{String(p.plotName ?? p.plotId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sens-filter-cat">CATEGORY</Label>
            <Select value={query.category || ALL} onValueChange={(v) => setQuery((q) => ({ ...q, category: v === ALL ? '' : v, pageNo: 1 }))}>
              <SelectTrigger id="sens-filter-cat" className="w-[160px]"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部 · All</SelectItem>
                <SelectItem value="environment">环境 · environment</SelectItem>
                <SelectItem value="soil">土壤 · soil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">No.</TableHead>
                <TableHead className="w-[130px]">Device No.</TableHead>
                <TableHead>Sensor Name</TableHead>
                <TableHead className="w-[120px]">Plot</TableHead>
                <TableHead className="w-[80px]">Category</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="min-w-[260px]">Latest</TableHead>
                <TableHead className="w-[170px]">Last Sample</TableHead>
                <TableHead className="w-[90px]">Op.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sensorList.map((s: any) => (
                <TableRow key={s.sensorId}>
                  <TableCell className="font-folio">{String(s.sensorId).padStart(3, '0')}</TableCell>
                  <TableCell className="font-folio text-[12px]">{String(s.deviceNo ?? '—')}</TableCell>
                  <TableCell>{String(s.sensorName ?? '—')}</TableCell>
                  <TableCell className="text-[12px]">{String(s.plotName ?? '—')}</TableCell>
                  <TableCell>
                    <Badge tone={s.category === 'environment' ? 'sand' : 'moss'}>
                      {s.category === 'environment' ? '环境' : '土壤'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-folio text-[11px]">{String(s.sensorType ?? '—')}</TableCell>
                  <TableCell>
                    <Badge tone={s.status === 'online' ? 'sage' : s.status === 'registered' ? 'neutral' : 'clay'}>
                      {String(s.status ?? '—')}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {s.latestMetrics && Object.keys(s.latestMetrics).length ? (
                      Object.entries(s.latestMetrics).map(([k, v]) => (
                        <Badge key={k} tone="neutral">{k}: {String(v)}</Badge>
                      ))
                    ) : (
                      <span className="font-serif italic text-[11px] text-ink-faint">No data</span>
                    )}
                  </TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">{String(s.lastSampleAt ?? '—')}</TableCell>
                  <TableCell>
                    <Button variant="link" size="sm" onClick={() => goHistory(s)}>历史</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sensorList.length === 0 && !sensorLoading && <TableEmpty>No sensors.</TableEmpty>}
          {sensorLoading && sensorList.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 10} total={sensorTotal}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>
    </PageShell>
  )
}
