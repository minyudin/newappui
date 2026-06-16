import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import PageShell from '@/components/shell/PageShell'
import {
  Button, Card, CardContent, CardHeader, CardSeal, CardTitle, Input, Label, Pagination,
  Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow,
} from '@/components/ui'
import { listSensorData } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import type { PageQuery } from '@/types/api'

/**
 * §11 Sensor Data · 传感器历史数据
 * 对齐 longarch-admin/src/views/SensorData.vue
 *  · 路由参数: sensorId / sensorName / deviceNo
 *  · 折线图 + 分页表格
 */

export default function SensorDataPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const sensorId = params.get('sensorId') ?? ''
  const sensorName = params.get('sensorName') ?? ''
  const deviceNo = params.get('deviceNo') ?? ''

  const [query, setQuery] = useState<PageQuery & { sensorType: string }>({
    pageNo: 1, pageSize: 50, sensorType: '',
  })

  // 传感器时序 · 实时型 (15s refetch)
  const p: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.sensorType) p.sensorType = query.sensorType
  const { data, isPending: loading } = useQuery({
    queryKey: qk.sensors.data(sensorId, p),
    queryFn: () => listSensorData(sensorId, p),
    enabled: !!sensorId,
    staleTime: STALE.LIVE,
    refetchInterval: REFETCH.LIVE,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  const chartOption = useMemo(() => {
    if (list.length === 0) return null
    const chronological = [...list].reverse().slice(-100)
    const groups: Record<string, Array<[string, number]>> = {}
    for (const item of chronological as any[]) {
      const type = String(item.sensorType ?? 'value')
      if (!groups[type]) groups[type] = []
      groups[type].push([String(item.sampleAt ?? ''), Number(item.value)])
    }
    const series = Object.entries(groups).map(([name, data]) => ({
      name, type: 'line', smooth: true, showSymbol: false, data,
    }))
    const xCats = chronological.map((d: any) => String(d.sampleAt ?? ''))
    const MORANDI_COLORS = ['#9fb58e', '#a0bcd0', '#d9c9a8', '#c5826a', '#9baa7a', '#a68c9c', '#7e9bc0']
    return {
      color: MORANDI_COLORS,
      tooltip: { trigger: 'axis', backgroundColor: '#f1efea', borderColor: '#c8c4bb', borderWidth: 1, textStyle: { color: '#2d2a26' }, extraCssText: 'box-shadow:none; border-radius:0;' },
      legend: { data: Object.keys(groups), bottom: 0, textStyle: { color: '#8a857b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' } },
      grid: { left: 60, right: 30, top: 20, bottom: 40 },
      xAxis: { type: 'category', data: xCats, axisLabel: { rotate: 30, fontSize: 10, color: '#8a857b' }, axisLine: { lineStyle: { color: '#c8c4bb' } } },
      yAxis: { type: 'value', axisLabel: { color: '#8a857b', fontSize: 10 }, splitLine: { lineStyle: { color: '#dcd8cf' } } },
      series,
    }
  }, [list])

  return (
    <PageShell
      seal="§11 · Series"
      title="Sensor Data"
      titleCn="传 感 器 数 据"
      lede="Numbers in time. The slow weather of a greenhouse."
      right={<Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← BACK</Button>}
    >
      {/* Meta */}
      <section className="folio-page__section" data-testid="sensor-meta">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="py-2 px-3 gap-0"><CardSeal>§ · DEVICE NO.</CardSeal></CardHeader>
            <CardContent className="px-3 py-3 font-folio text-ink">{deviceNo || '—'}</CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2 px-3 gap-0"><CardSeal>§ · SENSOR NAME</CardSeal></CardHeader>
            <CardContent className="px-3 py-3 font-sans text-ink">{sensorName || '—'}</CardContent>
          </Card>
          <Card>
            <CardHeader className="py-2 px-3 gap-0"><CardSeal>§ · SENSOR ID</CardSeal></CardHeader>
            <CardContent className="px-3 py-3 font-folio text-ink">{sensorId || '—'}</CardContent>
          </Card>
        </div>
      </section>

      {/* Filter */}
      <section className="folio-page__section flex flex-wrap items-end gap-3" data-testid="sensor-filter">
        <div className="flex flex-col gap-2 flex-1 max-w-[260px]">
          <Label htmlFor="sensor-filter-type">METRIC TYPE</Label>
          <Input
            id="sensor-filter-type"
            value={query.sensorType}
            onChange={(e) => setQuery((q) => ({ ...q, sensorType: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') setQuery((q) => ({ ...q, pageNo: 1 })) }}
            placeholder="温度 / pH / ..."
          />
        </div>
        <Button variant="secondary" onClick={() => setQuery((q) => ({ ...q, pageNo: 1 }))}>查询</Button>
        <Button variant="ghost" onClick={() => setQuery((q) => ({ ...q, sensorType: '', pageNo: 1 }))}>重置</Button>
      </section>

      {/* Chart */}
      <section className="folio-page__section" data-testid="sensor-chart">
        <Card>
          <CardHeader>
            <CardSeal>§ · Line chart</CardSeal>
            <CardTitle>折线图</CardTitle>
          </CardHeader>
          <CardContent>
            {chartOption ? (
              <ReactECharts option={chartOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
            ) : (
              <div className="py-10 text-center font-serif italic text-[13px] text-ink-faint">
                {loading ? 'Loading...' : 'No data yet.'}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Table */}
      <section className="folio-page__section" data-testid="sensor-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">ID</TableHead>
                <TableHead className="w-[140px]">Metric</TableHead>
                <TableHead className="w-[120px]">Value</TableHead>
                <TableHead className="w-[200px]">Sample At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r: any) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-folio">{String(r.id ?? '—')}</TableCell>
                  <TableCell className="font-folio text-[12px]">{String(r.sensorType ?? '—')}</TableCell>
                  <TableCell className="font-folio">{String(r.value ?? '—')}</TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">{String(r.sampleAt ?? '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {list.length === 0 && !loading && <TableEmpty>No sensor data.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1} pageSize={query.pageSize ?? 50} total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>
    </PageShell>
  )
}
