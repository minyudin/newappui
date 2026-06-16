import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import DigitFlipper from '@/components/digit/DigitFlipper'
import { getTaskDetail, listTasks, takeoverTask } from '@/api'
import { qk } from '@/lib/queryKeys'
import { REFETCH, STALE } from '@/lib/queryClient'
import { toast } from '@/lib/toast'
import type { OperationTask, PageQuery } from '@/types/api'
import TaskStatusStrip from './TaskStatusStrip'
import './TasksPage.scss'

/**
 * §10 Tasks · 操作任务
 * ============================================================
 *  对齐 longarch-admin/src/views/Tasks.vue
 *  · 筛选 taskStatus
 *  · 接管 (二次确认)
 * ============================================================ */

const STATUS_OPTIONS = [
  { value: 'pending',   cn: '待处理', tone: 'sand'    as const },
  { value: 'queued',    cn: '排队中', tone: 'fog'     as const },
  { value: 'running',   cn: '执行中', tone: 'moss'    as const },
  { value: 'success',   cn: '已完成', tone: 'sage'    as const },
  { value: 'failed',    cn: '失败',   tone: 'clay'    as const },
  { value: 'cancelled', cn: '已取消', tone: 'neutral' as const },
]

function statusMeta(s?: string) {
  return STATUS_OPTIONS.find((o) => o.value === s) ?? { value: s ?? '—', cn: s ?? '—', tone: 'neutral' as const }
}

/** 把 19 位雪花 taskNo 缩写为 T-xxxxxx (末 6 位) */
function shortTaskNo(no?: string) {
  if (!no) return '—'
  return no.length > 8 ? `${no.slice(0, 1)}-…${no.slice(-6)}` : no
}

/** 把 action_type 如 irrigation_apply → 灌溉下发 */
const ACTION_LABEL: Record<string, string> = {
  irrigation_apply: '灌溉下发',
  fertilize_apply: '施肥下发',
  spray_apply: '喷淋下发',
}
function actionLabel(s?: string) {
  return s ? (ACTION_LABEL[s] ?? s) : '—'
}

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<PageQuery & { taskStatus: string }>({
    pageNo: 1, pageSize: 10, taskStatus: '',
  })
  const [takeoverDlg, setTakeoverDlg] = useState<{ open: boolean; task: OperationTask | null }>({
    open: false, task: null,
  })
  const [processing, setProcessing] = useState(false)

  // 详情抽屉 · row snapshot + 异步 GET /operation-tasks/{id} 补齐 actionParams / queuedAt / cancelable
  const [detailDlg, setDetailDlg] = useState<{
    open: boolean
    task: OperationTask | null
    loading: boolean
  }>({ open: false, task: null, loading: false })

  async function openDetail(row: OperationTask) {
    setDetailDlg({ open: true, task: row, loading: true })
    try {
      const fresh = await getTaskDetail(row.taskId)
      setDetailDlg({ open: true, task: { ...row, ...fresh }, loading: false })
    } catch {
      setDetailDlg((prev) => ({ ...prev, loading: false }))
    }
  }

  // 状态型 · 15s stale + 30s 后台轮询
  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.taskStatus) params.taskStatus = query.taskStatus
  const { data, isPending: loading } = useQuery({
    queryKey: qk.tasks.list(params),
    queryFn: () => listTasks(params),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  // 全状态计数 · 拉一次大列表(只为 KPI 条用), staleTime 30s 避免抖动
  // 注: 若任务量超过 500, 改成后端 stat 接口; 当前演示场景 ≤ 200, 客户端聚合够用
  const allParams: PageQuery = { pageNo: 1, pageSize: 200 }
  const { data: allData } = useQuery({
    queryKey: qk.tasks.list(allParams),
    queryFn: () => listTasks(allParams),
    staleTime: STALE.STATUS,
    refetchInterval: REFETCH.STATUS,
  })
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of allData?.list ?? []) {
      const k = String(t.taskStatus ?? '')
      map[k] = (map[k] ?? 0) + 1
    }
    return map
  }, [allData])
  const countsTotal = allData?.total ?? Object.values(counts).reduce((a, b) => a + b, 0)

  async function handleTakeover() {
    if (!takeoverDlg.task) return
    setProcessing(true)
    try {
      await takeoverTask(takeoverDlg.task.taskId, { reason: '管理员接管' })
      toast.success('任务已接管')
      setTakeoverDlg({ open: false, task: null })
      // 使 tasks 所有缓存失效 → 自动重拉
      queryClient.invalidateQueries({ queryKey: qk.tasks.all() })
    } catch { /* interceptor */ } finally { setProcessing(false) }
  }

  return (
    <PageShell
      seal="§10 · Tasks"
      title="Operation Tasks"
      titleCn="操 作 任 务"
      lede="Every request becomes a task. No task, no actuator."
      right={
        <>
          <span>{total} ENTRIES</span>
          <span>·</span>
          <span>PAGE {String(query.pageNo).padStart(2, '0')}</span>
        </>
      }
    >
      {/* §10.1 · 状态 KPI 条 (替代下拉筛选) */}
      <section className="folio-page__section" data-testid="tasks-filter">
        <TaskStatusStrip
          active={query.taskStatus}
          onSelect={(s) => setQuery((q) => ({ ...q, taskStatus: s, pageNo: 1 }))}
          counts={counts}
          total={countsTotal}
        />
      </section>

      {/* Table */}
      <section className="folio-page__section" data-testid="tasks-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Task</TableHead>
                <TableHead className="min-w-[110px]">Requester</TableHead>
                <TableHead className="min-w-[120px]">Plot</TableHead>
                <TableHead className="min-w-[150px]">Device</TableHead>
                <TableHead className="min-w-[120px]">Action</TableHead>
                <TableHead className="w-[64px]">Prio.</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead className="w-[130px]">Op.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t, idx) => {
                const meta = statusMeta(t.taskStatus)
                const disabled = t.taskStatus === 'success' || t.taskStatus === 'failed' || t.taskStatus === 'cancelled'
                const breathingStatus = t.taskStatus === 'running' || t.taskStatus === 'pending' || t.taskStatus === 'failed'
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                const priority = Number(t.priority ?? 0)
                return (
                  <TableRow key={t.taskId} className="tasks-row">
                    <TableCell
                      className="font-folio text-[12px] text-ink"
                      title={String(t.taskNo ?? '')}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="tasks-row__seal">{rowSeal}</span>
                        <span className="tasks-row__no">
                          <DigitFlipper value={shortTaskNo(t.taskNo)} mono size="compact" />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {t.requesterName ? (
                        <span className="text-ink">{t.requesterName}</span>
                      ) : (
                        <span className="text-ink-faint italic">未知</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {t.plotName ? (
                        <span className="text-ink">{t.plotName}</span>
                      ) : (
                        <span className="text-ink-faint italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {t.deviceName || t.deviceNo ? (
                        <div className="flex flex-col">
                          <span className="text-ink leading-tight">{t.deviceName ?? ''}</span>
                          {t.deviceNo && (
                            <span className="font-folio text-[10px] text-ink-faint leading-tight">{t.deviceNo}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-faint italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-ink">{actionLabel(t.actionType)}</TableCell>
                    <TableCell>
                      {/* priority 用 ●●○ 三段点表示 (1/2/3), 比裸数字更克制 */}
                      <span className="tasks-row__prio" data-prio={priority}>
                        <span className="tasks-row__prio-dot" />
                        <span className="tasks-row__prio-dot" />
                        <span className="tasks-row__prio-dot" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`tasks-row__status${breathingStatus ? ' tasks-row__status--breath' : ''}`} data-status={t.taskStatus}>
                        <span className="tasks-row__status-dot" />
                        <Badge tone={meta.tone}>{meta.cn}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="font-folio text-[11px] text-ink-soft">{String(t.createdAt ?? '—')}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => openDetail(t)}
                          data-testid={`tasks-row-detail-${t.taskId}`}
                        >
                          详情
                        </Button>
                        <span className="text-ink-faint text-[10px]">·</span>
                        <Button
                          variant="link"
                          size="sm"
                          disabled={disabled}
                          onClick={() => setTakeoverDlg({ open: true, task: t })}
                          data-testid={`tasks-row-takeover-${t.taskId}`}
                        >
                          接管
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {list.length === 0 && !loading && <TableEmpty>No operation tasks.</TableEmpty>}
          {loading && list.length === 0 && <TableEmpty>Loading folio…</TableEmpty>}
          <div className="px-4">
            <Pagination
              pageNo={query.pageNo ?? 1}
              pageSize={query.pageSize ?? 10}
              total={total}
              onPageChange={(p) => setQuery((q) => ({ ...q, pageNo: p }))}
            />
          </div>
        </Card>
      </section>

      {/* Takeover confirm */}
      <Dialog open={takeoverDlg.open} onOpenChange={(open) => setTakeoverDlg((d) => ({ ...d, open }))}>
        <DialogContent className="w-[min(420px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogSeal>§ ACTION · takeover</DialogSeal>
            <DialogTitle>确认接管任务?</DialogTitle>
            <DialogDescription>This will override any in-flight execution.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="font-folio text-[13px] text-ink">
              {String(takeoverDlg.task?.taskNo ?? '')}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">取消</Button></DialogClose>
            <Button
              variant="primary"
              onClick={handleTakeover}
              disabled={processing}
              data-testid="tasks-takeover-submit"
            >
              {processing ? '接管中...' : '确认接管'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务详情 · row snapshot + fresh GET /operation-tasks/{id} 合并, 展 actionParams / 全生命周期时间 */}
      <Dialog
        open={detailDlg.open}
        onOpenChange={(open) => {
          if (!open) setDetailDlg({ open: false, task: null, loading: false })
        }}
      >
        <DialogContent className="w-[min(600px,calc(100vw-32px))]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · task</DialogSeal>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              Folio record merged from list snapshot and GET /operation-tasks/&#123;id&#125;.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailDlg.task ? (() => {
              const t = detailDlg.task as OperationTask & {
                taskNo?: string
                requesterName?: string | null
                requestUserId?: number | null
                plotName?: string | null
                plotId?: number | null
                deviceNo?: string | null
                deviceName?: string | null
                deviceId?: number | null
                actionType?: string
                actionName?: string
                actionParams?: Record<string, unknown> | null
                schedulingMode?: string
                priority?: number
                deviceExecutionState?: string
                queueNo?: number | null
                estimatedWaitMinutes?: number | null
                queuedAt?: string | null
                startedAt?: string | null
                finishedAt?: string | null
                failReason?: string | null
                reviewState?: string
                riskLevel?: string
                riskReasons?: string
                assigneeUserId?: number | null
                cancelable?: boolean
              }
              const meta = statusMeta(t.taskStatus)
              const riskTone = (r?: string): 'sage' | 'sand' | 'clay' | 'neutral' => {
                if (r === 'high') return 'clay'
                if (r === 'medium') return 'sand'
                if (r === 'low') return 'sage'
                return 'neutral'
              }
              const paramsJson = t.actionParams && Object.keys(t.actionParams).length > 0
                ? JSON.stringify(t.actionParams, null, 2)
                : null
              return (
                <dl className="grid grid-cols-[minmax(0,110px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">taskId</dt>
                  <dd className="font-folio text-ink">
                    {t.taskId}
                    {detailDlg.loading ? (
                      <span className="font-folio text-[11px] text-ink-faint ml-2">refreshing…</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">taskNo</dt>
                  <dd className="font-folio text-[12px] text-ink break-all">{String(t.taskNo ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">action</dt>
                  <dd className="text-ink">{actionLabel(t.actionType)} <span className="font-folio text-[11px] text-ink-faint ml-1">{String(t.actionType ?? '')}</span></dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">status</dt>
                  <dd><Badge tone={meta.tone}>{meta.cn}</Badge></dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">exec state</dt>
                  <dd className="font-folio text-[12px] text-ink">{String(t.deviceExecutionState ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">scheduling</dt>
                  <dd className="font-folio text-[12px] text-ink">{String(t.schedulingMode ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">queueNo</dt>
                  <dd className="font-folio text-ink">
                    {t.queueNo != null ? `#${t.queueNo}` : '—'}
                    {t.estimatedWaitMinutes != null ? (
                      <span className="font-folio text-[11px] text-ink-faint ml-2">约 {t.estimatedWaitMinutes} 分钟</span>
                    ) : null}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">priority</dt>
                  <dd className="font-folio text-ink">{t.priority != null ? String(t.priority) : '—'}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">cancelable</dt>
                  <dd>
                    <Badge tone={t.cancelable ? 'sage' : 'neutral'}>
                      {t.cancelable ? '可取消' : '不可取消'}
                    </Badge>
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">requester</dt>
                  <dd className="text-ink">
                    {t.requestUserId ? (
                      <>
                        <span>{String(t.requesterName ?? '—')}</span>
                        <span className="font-folio text-[11px] text-ink-faint ml-2">#{t.requestUserId}</span>
                      </>
                    ) : <span className="text-ink-faint">—</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">plot</dt>
                  <dd className="text-ink">
                    {t.plotId ? (
                      <>
                        <span>{String(t.plotName ?? '—')}</span>
                        <span className="font-folio text-[11px] text-ink-faint ml-2">#{t.plotId}</span>
                      </>
                    ) : <span className="text-ink-faint">—</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">device</dt>
                  <dd className="text-ink">
                    {t.deviceId ? (
                      <>
                        <span>{String(t.deviceName ?? '—')}</span>
                        {t.deviceNo ? (
                          <span className="font-folio text-[11px] text-ink-faint ml-2">{String(t.deviceNo)}</span>
                        ) : null}
                        <span className="font-folio text-[11px] text-ink-faint ml-2">#{t.deviceId}</span>
                      </>
                    ) : <span className="text-ink-faint">—</span>}
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">reviewState</dt>
                  <dd>
                    <Badge tone={t.reviewState === 'operator_required' ? 'sand' : t.reviewState === 'approved' ? 'sage' : t.reviewState === 'rejected' ? 'clay' : 'neutral'}>
                      {String(t.reviewState ?? 'none')}
                    </Badge>
                  </dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">riskLevel</dt>
                  <dd><Badge tone={riskTone(t.riskLevel)}>{String(t.riskLevel ?? '—').toUpperCase()}</Badge></dd>
                  {t.riskReasons ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">riskReasons</dt>
                      <dd className="font-folio text-[12px] text-ink break-all">{String(t.riskReasons)}</dd>
                    </>
                  ) : null}
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">assignee</dt>
                  <dd className="font-folio text-ink">{t.assigneeUserId != null ? `#${t.assigneeUserId}` : <span className="text-ink-faint">未认领</span>}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(t.createdAt ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">queuedAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(t.queuedAt ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">startedAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(t.startedAt ?? '—')}</dd>
                  <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">finishedAt</dt>
                  <dd className="font-folio text-[12px] text-ink-soft">{String(t.finishedAt ?? '—')}</dd>
                  {t.failReason ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">failReason</dt>
                      <dd className="text-clay break-all">{String(t.failReason)}</dd>
                    </>
                  ) : null}
                  {paramsJson ? (
                    <>
                      <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">actionParams</dt>
                      <dd>
                        <pre className="font-folio text-[11px] text-ink bg-paper-deep/40 border border-line-soft px-3 py-2 whitespace-pre-wrap break-all overflow-auto max-h-60">
{paramsJson}
                        </pre>
                      </dd>
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
