import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import PageShell from '@/components/shell/PageShell'
import { PlotSelect, UserSelect } from '@/components/selects'
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { createCode, createOrder, createPlot, createUser, listDevices, listPlots } from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import type {
  AdminUser,
  AdoptionCode,
  AdoptionOrder,
  Plot,
} from '@/types/api'

/**
 * §+ Adoption Wizard · 一站式创建认养
 * ============================================================
 *  把散落在 Users/Plots/Orders/Codes 四页的手工跨页流程合成一次,
 *  admin 单页从零生成: user(可新建) + order + adoption code.
 *
 *  四段式:
 *    ① 地块 · PlotSelect 必填
 *    ② 用户 · UserSelect 现有 或 + 创建新用户 (openId+nickname+roleType)
 *    ③ 认养期限 · start/end 必填 · amount/remark 选填
 *    ④ 认养码 · 默认同时生成, 可关 · 期限默认跟订单
 *
 *  提交链:
 *    [新用户?] → createUser → userId
 *    → createOrder → order
 *    → [要认养码?] → createCode → code
 *
 *  成功页: 展示 orderId + adoption code + 快捷跳转.
 * ============================================================ */

const CODE_TYPE_OPTIONS = [
  { value: 'master', cn: '主码 · master' },
  { value: 'guest', cn: '访客码 · guest' },
  { value: 'share', cn: '分享码 · share' },
] as const

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

type UserMode = 'existing' | 'new'
type PlotMode = 'existing' | 'new'

interface WizardForm {
  // §1
  plotMode: PlotMode
  plotId: string
  newPlotName: string
  newPlotNo: string
  newFarmName: string
  newParentId: string
  newAreaSize: string
  newLongitude: string
  newLatitude: string
  newIntroText: string
  // §2
  userMode: UserMode
  userId: string
  newUserOpenId: string
  newUserNickname: string
  newUserRoleType: 'adopter' | 'operator' | 'agronomist' | 'admin'
  // §3
  startAt: string
  endAt: string
  payableAmount: string
  remark: string
  // §4
  generateCode: boolean
  codeType: string
  codeValidFrom: string
  codeValidTo: string
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

const EMPTY_FORM: WizardForm = {
  plotMode: 'existing',
  plotId: '',
  newPlotName: '',
  newPlotNo: '',
  newFarmName: '',
  newParentId: '',
  newAreaSize: '',
  newLongitude: '',
  newLatitude: '',
  newIntroText: '',
  userMode: 'existing',
  userId: '',
  newUserOpenId: '',
  newUserNickname: '',
  newUserRoleType: 'adopter',
  startAt: '',
  endAt: '',
  payableAmount: '',
  remark: '',
  generateCode: true,
  codeType: 'master',
  codeValidFrom: '',
  codeValidTo: '',
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

interface WizardResult {
  order: AdoptionOrder
  code: AdoptionCode | null
  resolvedUser: AdminUser | null
  plot: Plot | null
}

import WizardStepper, { type WizardStep } from './WizardStepper'

/** 小段标题 · "§x · XX" 风格, 配页面 Folio 美学 */
function SectionSeal({ seal, titleCn, titleEn }: {
  seal: string
  titleCn: string
  titleEn: string
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line-soft pb-2">
      <span className="font-folio text-[10px] uppercase tracking-[0.28em] text-ink-soft">
        {seal}
      </span>
      <span className="font-serif text-[20px] leading-tight text-ink">{titleCn}</span>
      <span className="font-sans text-[12px] text-ink-faint italic">{titleEn}</span>
    </div>
  )
}

/** 把 datetime-local 值转成后端期望的 "YYYY-MM-DD HH:mm:ss" */
function toBackendTime(v: string): string {
  if (!v) return ''
  return v.replace('T', ' ') + ':00'
}

export default function AdoptionWizardPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [form, setForm] = useState<WizardForm>(EMPTY_FORM)
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<WizardResult | null>(null)

  // 方便 §4 · 没手填的话默认跟 §3 同期限
  const effectiveValidFrom = form.codeValidFrom || form.startAt
  const effectiveValidTo = form.codeValidTo || form.endAt
  const selectedPlotId = Number(form.plotId || 0)
  const plotsAllParams = useMemo(() => ({ pageNo: 1, pageSize: 100 }), [])
  const { data: plotsAllData } = useQuery({
    queryKey: qk.plots.list(plotsAllParams),
    queryFn: () => listPlots(plotsAllParams),
  })
  const greenhouses = useMemo(
    () => (plotsAllData?.list ?? []).filter((p) => !p.parentId),
    [plotsAllData],
  )
  const devicesParams = useMemo(
    () => ({ pageNo: 1, pageSize: 200, plotId: selectedPlotId }),
    [selectedPlotId],
  )
  const { data: plotDevicesData } = useQuery({
    queryKey: qk.devices.list(devicesParams),
    queryFn: () => listDevices(devicesParams),
    enabled: form.generateCode && selectedPlotId > 0,
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

  const canSubmit = useMemo(() => {
    if (form.plotMode === 'existing' && !form.plotId) return false
    if (form.plotMode === 'new' && !form.newPlotName.trim()) return false
    if (form.userMode === 'existing' && !form.userId) return false
    if (
      form.userMode === 'new' &&
      (!form.newUserOpenId.trim() || !form.newUserNickname.trim())
    )
      return false
    if (!form.startAt || !form.endAt) return false
    if (form.generateCode && (!effectiveValidFrom || !effectiveValidTo)) return false
    return true
  }, [form, effectiveValidFrom, effectiveValidTo])

  /**
   * Wizard 4 步进度状态计算
   * ============================================================
   *  · 第 N 步 done 的判定 = 该 section 必填项已满足
   *  · "active" = 当前还未完成且前序已完成的第一个步骤
   *  · pending = 后续步骤
   *
   *  约定: 如果第 1 步未完成, 第 2 步默认 active (其实是 pending), 但
   *       UI 视觉上要先看到一个"高亮的当前步", 否则 stepper 全灰
   *       看着像断了. 所以"active"始终是顺序上第一个 not-done 的步骤
   * ============================================================ */
  const wizardSteps: WizardStep[] = useMemo(() => {
    const step1Done =
      (form.plotMode === 'existing' && !!form.plotId) ||
      (form.plotMode === 'new' && form.newPlotName.trim() !== '')
    const step2Done =
      (form.userMode === 'existing' && !!form.userId) ||
      (form.userMode === 'new' &&
        form.newUserOpenId.trim() !== '' &&
        form.newUserNickname.trim() !== '')
    const step3Done = !!form.startAt && !!form.endAt
    // §4 是可选段, 如果不生成认养码就视为已完成 (跳过), 否则要满足时间区间
    const step4Done = !form.generateCode || (!!effectiveValidFrom && !!effectiveValidTo)
    const dones = [step1Done, step2Done, step3Done, step4Done]
    const firstActive = dones.findIndex((d) => !d)

    return [
      { seal: '§1', cn: '地块',     en: 'PLOT', anchor: 'wiz-sec-plot',
        state: dones[0] ? 'done' : firstActive === 0 ? 'active' : 'pending' },
      { seal: '§2', cn: '认养人',   en: 'USER', anchor: 'wiz-sec-user',
        state: dones[1] ? 'done' : firstActive === 1 ? 'active' : 'pending' },
      { seal: '§3', cn: '认养期限', en: 'TERM', anchor: 'wiz-sec-term',
        state: dones[2] ? 'done' : firstActive === 2 ? 'active' : 'pending' },
      { seal: '§4', cn: '认养码',   en: 'CODE', anchor: 'wiz-sec-code',
        state: dones[3] ? 'done' : firstActive === 3 ? 'active' : 'pending' },
    ]
  }, [form, effectiveValidFrom, effectiveValidTo])

  function updateForm<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    if (form.generateCode && form.canOperate && !ACTION_CAPS.some((a) => form[a.key])) {
      toast.warning('已开启可操作时，至少勾选一个动作白名单')
      return
    }
    setSubmitting(true)
    const picked: WizardResult = {
      order: null as unknown as AdoptionOrder,
      code: null,
      resolvedUser: selectedUser,
      plot: selectedPlot,
    }
    try {
      // ① 用户 · 新建分支
      let effectiveUserId: number | null = null
      let effectivePlotId: number | null = null
      let effectivePlot: Plot | null = selectedPlot
      if (form.userMode === 'new') {
        // stub 模式对齐: wechatLogin 会把 code 前缀 `stub_` 写入 user.open_id,
        // 这里提交前统一补齐 stub_, 保证 miniapp 用 stub_device_id 能查到同一个 user.
        // 如果用户已经手输了 stub_ 前缀则幂等跳过; 真实 wechat openId (wx_ 开头) 透传.
        const rawOpenId = form.newUserOpenId.trim()
        const normalizedOpenId =
          rawOpenId.startsWith('stub_') || rawOpenId.startsWith('wx_')
            ? rawOpenId
            : `stub_${rawOpenId}`
        const u = await createUser({
          openId: normalizedOpenId,
          nickname: form.newUserNickname.trim(),
          roleType: form.newUserRoleType,
        })
        effectiveUserId = u.userId
        picked.resolvedUser = u
        queryClient.invalidateQueries({ queryKey: qk.users.all() })
      } else {
        effectiveUserId = Number(form.userId)
      }

      // ①.5 地块 · 新建分支
      if (form.plotMode === 'new') {
        const p = await createPlot({
          plotName: form.newPlotName.trim(),
          plotNo: form.newPlotNo.trim() || undefined,
          farmName: form.newFarmName.trim() || undefined,
          parentId: form.newParentId ? Number(form.newParentId) : undefined,
          areaSize: form.newAreaSize ? Number(form.newAreaSize) : undefined,
          longitude: form.newLongitude ? Number(form.newLongitude) : undefined,
          latitude: form.newLatitude ? Number(form.newLatitude) : undefined,
          introText: form.newIntroText.trim() || undefined,
        })
        effectivePlotId = Number(p.plotId)
        effectivePlot = p as Plot
        picked.plot = effectivePlot
        queryClient.invalidateQueries({ queryKey: qk.plots.all() })

      } else {
        effectivePlotId = Number(form.plotId)
      }

      // ② 订单
      const order = await createOrder({
        plotId: effectivePlotId,
        userId: effectiveUserId || undefined,
        startAt: toBackendTime(form.startAt),
        endAt: toBackendTime(form.endAt),
        payableAmount: form.payableAmount ? Number(form.payableAmount) : undefined,
        remark: form.remark || undefined,
      })
      picked.order = order
      picked.plot = effectivePlot
      queryClient.invalidateQueries({ queryKey: qk.orders.all() })

      // ③ 认养码 (可选)
      if (form.generateCode) {
        const c = await createCode({
          orderId: order.orderId,
          codeType: form.codeType,
          validFrom: toBackendTime(effectiveValidFrom),
          validTo: toBackendTime(effectiveValidTo),
          dailyAccessStart: form.dailyAccessStart,
          dailyAccessEnd: form.dailyAccessEnd,
          permissions: {
            canViewLive: form.canViewLive,
            canViewHistory: form.canViewHistory,
            canViewSensor: form.canViewSensor,
            canOperate: form.canOperate,
            maxDailyOperations: Number(form.maxDailyOperations || '0') || 0,
            shareable: form.shareable,
            operationWhitelist: ACTION_CAPS.filter((a) => form[a.key]).map((a) => a.actionType),
          },
        })
        picked.code = c
        queryClient.invalidateQueries({ queryKey: qk.codes.all() })
      }

      toast.success('认养已创建')
      setResult(picked)
    } catch {
      // http 拦截器已 toast
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setForm(EMPTY_FORM)
    setSelectedPlot(null)
    setSelectedUser(null)
    setResult(null)
  }

  // ============================================================
  // 成功页
  // ============================================================
  if (result) {
    return (
      <PageShell
        seal="§+ · Wizard · done"
        title="Adoption Created"
        titleCn="认 养 完 成"
        lede="One adoption sealed. Hand the code to the adopter."
        right={
          <>
            <span>ORDER</span>
            <span>·</span>
            <span>#{String(result.order.orderId).padStart(3, '0')}</span>
          </>
        }
      >
        <section className="folio-page__section">
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <span className="font-folio text-[10px] uppercase tracking-[0.28em] text-ink-faint">
                § 订单 · Order
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-[22px] leading-tight text-ink">
                  {String(result.order.orderNo ?? '') || `#${result.order.orderId}`}
                </span>
                <Badge tone="sage">{String(result.order.orderStatus ?? 'pending')}</Badge>
              </div>
              <span className="font-sans text-[12px] text-ink-soft">
                地块 ·{' '}
                {String(result.plot?.plotName ?? '') ||
                  String(result.plot?.name ?? '') ||
                  `#${form.plotId}`}
                {result.resolvedUser
                  ? `  ·  认养人 · ${
                      result.resolvedUser.nickname ||
                      result.resolvedUser.realName ||
                      `#${result.resolvedUser.userId}`
                    }`
                  : ''}
              </span>
            </div>

            {result.code ? (
              <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4">
                <span className="font-folio text-[10px] uppercase tracking-[0.28em] text-ink-faint">
                  § 认养码 · Adoption Code
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <code className="font-mono text-[18px] break-all text-ink border border-line-soft bg-paper-light px-3 py-2">
                    {result.code.code || `#${result.code.codeId}`}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!result.code?.code) return
                      navigator.clipboard
                        ?.writeText(result.code.code)
                        .then(() => toast.success('已复制'))
                        .catch(() => toast.warning('复制失败, 请手动选中'))
                    }}
                  >
                    复制
                  </Button>
                </div>
                <span className="font-sans text-[11px] text-ink-faint">
                  认养人在小程序里输入此码即可激活订阅。
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-2">
              <Button variant="primary" onClick={handleReset}>
                再建一单
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(`/orders`)}
              >
                去订单页
              </Button>
              {result.code ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/codes`)}
                >
                  去认养码页
                </Button>
              ) : null}
            </div>
          </Card>
        </section>
      </PageShell>
    )
  }

  // ============================================================
  // 表单页
  // ============================================================
  return (
    <PageShell
      seal="§+ · Wizard"
      title="New Adoption"
      titleCn="新 建 认 养"
      lede="Compose a plot, a person, a span of time — one form, one seal."
      right={
        <>
          <span>{wizardSteps.filter((s) => s.state === 'done').length}/4 STEPS</span>
          <span>·</span>
          <span>WIZARD</span>
        </>
      }
    >
      {/* §0 · 进度条 (替代了原右上角 4 段方块, 给出实时完成度) */}
      <section className="folio-page__section">
        <WizardStepper steps={wizardSteps} />
      </section>

      <section className="folio-page__section flex flex-col gap-4">

        {/* §1 · 地块 */}
        <Card id="wiz-sec-plot" className="p-4 flex flex-col gap-3 scroll-mt-6">
          <SectionSeal seal="§1" titleCn="地块" titleEn="Plot" />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 font-sans text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="wiz-plot-mode"
                value="existing"
                checked={form.plotMode === 'existing'}
                onChange={() => updateForm('plotMode', 'existing')}
              />
              选择已有地块
            </label>
            <label className="flex items-center gap-2 font-sans text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="wiz-plot-mode"
                value="new"
                checked={form.plotMode === 'new'}
                onChange={() => updateForm('plotMode', 'new')}
              />
              新建地块并配置设备
            </label>
          </div>
          {form.plotMode === 'existing' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-plot">PLOT *</Label>
              <PlotSelect
                id="wiz-plot"
                value={form.plotId}
                selectedItem={selectedPlot}
                onChange={(v, item) => {
                  updateForm('plotId', v)
                  setSelectedPlot(item)
                }}
              />
              <span className="font-sans text-[11px] text-ink-faint">
                支持按地块名、地块编号、农场名、id 搜索。
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label htmlFor="wiz-new-plot-name">地块名称 *</Label>
                  <Input
                    id="wiz-new-plot-name"
                    value={form.newPlotName}
                    onChange={(e) => updateForm('newPlotName', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-plot-no">地块编号</Label>
                  <Input
                    id="wiz-new-plot-no"
                    value={form.newPlotNo}
                    onChange={(e) => updateForm('newPlotNo', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-parent">上级大棚</Label>
                  <Select
                    value={form.newParentId || '__none__'}
                    onValueChange={(v) => updateForm('newParentId', v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger id="wiz-new-parent"><SelectValue placeholder="不选则按大棚级创建" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">无 · 大棚级</SelectItem>
                      {greenhouses.map((g) => (
                        <SelectItem key={g.plotId} value={String(g.plotId)}>
                          {String(g.plotName ?? g.name ?? g.plotId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-farm">农场名</Label>
                  <Input
                    id="wiz-new-farm"
                    value={form.newFarmName}
                    onChange={(e) => updateForm('newFarmName', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-area">面积</Label>
                  <Input
                    id="wiz-new-area"
                    type="number"
                    step="0.01"
                    min={0}
                    value={form.newAreaSize}
                    onChange={(e) => updateForm('newAreaSize', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-lng">经度</Label>
                  <Input
                    id="wiz-new-lng"
                    type="number"
                    step="0.000001"
                    value={form.newLongitude}
                    onChange={(e) => updateForm('newLongitude', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wiz-new-lat">纬度</Label>
                  <Input
                    id="wiz-new-lat"
                    type="number"
                    step="0.000001"
                    value={form.newLatitude}
                    onChange={(e) => updateForm('newLatitude', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <Label htmlFor="wiz-new-intro">备注</Label>
                  <Input
                    id="wiz-new-intro"
                    value={form.newIntroText}
                    onChange={(e) => updateForm('newIntroText', e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-md border border-line-soft p-3 text-[12px] text-ink-soft">
                执行设备绑定统一在 Plots 页进行，Wizard 仅负责新建地块与认养流程配置。
              </div>
            </div>
          )}
        </Card>

        {/* §2 · 用户 */}
        <Card id="wiz-sec-user" className="p-4 flex flex-col gap-3 scroll-mt-6">
          <SectionSeal seal="§2" titleCn="认养人" titleEn="User" />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 font-sans text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="wiz-user-mode"
                value="existing"
                checked={form.userMode === 'existing'}
                onChange={() => updateForm('userMode', 'existing')}
              />
              选择已有用户
            </label>
            <label className="flex items-center gap-2 font-sans text-[13px] text-ink cursor-pointer">
              <input
                type="radio"
                name="wiz-user-mode"
                value="new"
                checked={form.userMode === 'new'}
                onChange={() => updateForm('userMode', 'new')}
              />
              顺手创建新用户
            </label>
          </div>

          {form.userMode === 'existing' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-user">USER *</Label>
              <UserSelect
                id="wiz-user"
                value={form.userId}
                selectedItem={selectedUser}
                onChange={(v, item) => {
                  updateForm('userId', v)
                  setSelectedUser(item)
                }}
              />
              <span className="font-sans text-[11px] text-ink-faint">
                支持按昵称、手机号、openId、userNo 搜索。
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiz-new-openid">OPENID *</Label>
                <Input
                  id="wiz-new-openid"
                  value={form.newUserOpenId}
                  onChange={(e) => updateForm('newUserOpenId', e.target.value)}
                  placeholder="输入 stub deviceId, 如 ad_001 / kiro_ad_001"
                />
                <span className="font-sans text-[11px] text-ink-faint">
                  此 ID 将作为 miniapp 的 stub code · 提交时自动补 <code className="font-folio">stub_</code> 前缀
                  （与 stub 模式 wechatLogin 语义对齐; 真实 wx openId 请以 <code className="font-folio">wx_</code> 开头，将原样保存）。
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiz-new-name">昵称 *</Label>
                <Input
                  id="wiz-new-name"
                  value={form.newUserNickname}
                  onChange={(e) => updateForm('newUserNickname', e.target.value)}
                  placeholder="展示给认养人"
                />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="wiz-new-role">ROLE</Label>
                <Select
                  value={form.newUserRoleType}
                  onValueChange={(v) =>
                    updateForm(
                      'newUserRoleType',
                      v as WizardForm['newUserRoleType'],
                    )
                  }
                >
                  <SelectTrigger id="wiz-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adopter">认养人 · adopter</SelectItem>
                    <SelectItem value="operator">操作员 · operator</SelectItem>
                    <SelectItem value="agronomist">农艺师 · agronomist</SelectItem>
                    <SelectItem value="admin">管理员 · admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </Card>

        {/* §3 · 认养期限 */}
        <Card id="wiz-sec-term" className="p-4 flex flex-col gap-3 scroll-mt-6">
          <SectionSeal seal="§3" titleCn="认养期限" titleEn="Term" />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-start">START *</Label>
              <Input
                id="wiz-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => updateForm('startAt', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-end">END *</Label>
              <Input
                id="wiz-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => updateForm('endAt', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-amount">AMOUNT</Label>
              <Input
                id="wiz-amount"
                type="number"
                step="0.01"
                min={0}
                value={form.payableAmount}
                onChange={(e) => updateForm('payableAmount', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wiz-remark">REMARK</Label>
              <Input
                id="wiz-remark"
                value={form.remark}
                onChange={(e) => updateForm('remark', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* §4 · 认养码 */}
        <Card id="wiz-sec-code" className="p-4 flex flex-col gap-3 scroll-mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-line-soft pb-2">
            <div className="flex items-baseline gap-3">
              <span className="font-folio text-[10px] uppercase tracking-[0.28em] text-ink-faint">
                §4
              </span>
              <span className="font-serif text-[18px] leading-tight text-ink">认养码</span>
              <span className="font-sans text-[11px] text-ink-faint italic">Code</span>
            </div>
            <label className="flex items-center gap-2 font-sans text-[13px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.generateCode}
                onChange={(e) => updateForm('generateCode', e.target.checked)}
              />
              同时生成认养码
            </label>
          </div>

          {form.generateCode ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiz-code-type">TYPE</Label>
                <Select
                  value={form.codeType}
                  onValueChange={(v) => updateForm('codeType', v)}
                >
                  <SelectTrigger id="wiz-code-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CODE_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.cn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiz-code-from">VALID FROM</Label>
                <Input
                  id="wiz-code-from"
                  type="datetime-local"
                  value={form.codeValidFrom}
                  onChange={(e) => updateForm('codeValidFrom', e.target.value)}
                  placeholder={form.startAt}
                />
                <span className="font-sans text-[11px] text-ink-faint">
                  留空则同订单 START
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wiz-code-to">VALID TO</Label>
                <Input
                  id="wiz-code-to"
                  type="datetime-local"
                  value={form.codeValidTo}
                  onChange={(e) => updateForm('codeValidTo', e.target.value)}
                  placeholder={form.endAt}
                />
                <span className="font-sans text-[11px] text-ink-faint">
                  留空则同订单 END
                </span>
              </div>
              <div className="col-span-3 rounded-md border border-line-soft bg-paper-light p-3 flex flex-col gap-2">
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
                  <span className="text-[12px] text-ink-faint">先选择地块后显示设备能力</span>
                )}
              </div>
              <div className="col-span-3 rounded-md border border-line-soft p-3 flex flex-col gap-3">
                <div className="font-folio text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                  § PERMISSION · 小程序权限下发
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.canViewLive}
                      onChange={(e) => updateForm('canViewLive', e.target.checked)}
                    />
                    允许看直播
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.canViewHistory}
                      onChange={(e) => updateForm('canViewHistory', e.target.checked)}
                    />
                    允许看历史
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.canViewSensor}
                      onChange={(e) => updateForm('canViewSensor', e.target.checked)}
                    />
                    允许看传感器
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.canOperate}
                      onChange={(e) => updateForm('canOperate', e.target.checked)}
                    />
                    允许操作
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-ink">
                    <input
                      type="checkbox"
                      checked={form.shareable}
                      onChange={(e) => updateForm('shareable', e.target.checked)}
                    />
                    允许分享
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wiz-daily-start">操作开始</Label>
                    <Input
                      id="wiz-daily-start"
                      type="time"
                      step="1"
                      value={form.dailyAccessStart.slice(0, 8)}
                      onChange={(e) =>
                        updateForm('dailyAccessStart', `${e.target.value}:00`.slice(0, 8))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wiz-daily-end">操作结束</Label>
                    <Input
                      id="wiz-daily-end"
                      type="time"
                      step="1"
                      value={form.dailyAccessEnd.slice(0, 8)}
                      onChange={(e) =>
                        updateForm('dailyAccessEnd', `${e.target.value}:00`.slice(0, 8))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="wiz-max-daily">每日操作上限</Label>
                    <Input
                      id="wiz-max-daily"
                      type="number"
                      min={0}
                      value={form.maxDailyOperations}
                      onChange={(e) => updateForm('maxDailyOperations', e.target.value)}
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
                          checked={form[a.key]}
                          onChange={(e) => updateForm(a.key, e.target.checked)}
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="font-sans text-[12px] text-ink-faint">
              不生成认养码 · 订单创建后可在 §4 认养码 页手动生成。
            </div>
          )}
        </Card>

        {/* Submit bar */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={handleReset} disabled={submitting}>
            重置
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            data-testid="wizard-submit"
          >
            {submitting ? '创建中…' : '一键生成 · Create'}
          </Button>
        </div>
      </section>
    </PageShell>
  )
}
