import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro, { useRouter, usePullDownRefresh, useUnload } from '@tarojs/taro'
import { useMemo, useRef, useState } from 'react'
import { usePageRefresh } from '@/hooks/usePageRefresh'
import {
  getAllowedActions,
  createOperationTask,
  genIdempotencyKey,
} from '@/api/task'
import { getOperationLogs } from '@/api/plot'
import { getCameraList } from '@/api/camera'
import { useAuthStore } from '@/store/auth'
import type {
  AllowedAction,
  Camera,
  OperationTaskListItem,
  TaskStatusValue,
} from '@/types'
import './index.scss'

/**
 * §4 · 操作任务 (按地块)
 * ============================================================
 *  入口: /pages/task/index?plotId=X&plotName=Y
 *
 *  流程:
 *    1. useLoad 读路由 plotId → 拉 allowed-actions + /my/operation-tasks
 *    2. 3 个 action 按钮: 浇水/施肥/喷淋
 *    3. 点按钮 → 弹底部 sheet · 填 durationMinutes + 可选参数
 *    4. 提交 → createOperationTask → 跳详情页 或 刷新本页
 * ============================================================ */

// 任务状态 → 显示
const TASK_STATUS_LABEL: Record<TaskStatusValue, { text: string; tone: string }> = {
  pending: { text: '待处理', tone: 'sand' },
  queued: { text: '已排队', tone: 'fog' },
  running: { text: '执行中', tone: 'sage' },
  success: { text: '已完成', tone: 'sage' },
  failed: { text: '已失败', tone: 'clay' },
  cancelled: { text: '已取消', tone: 'ink-faint' },
}

// 动作类型 → 图标 class (login 页里定义的 SVG data URI 复用)
const ACTION_ICON: Record<string, string> = {
  irrigation_apply: 'action-icon--water',
  fertilize_apply: 'action-icon--fertilize',
  spray_apply: 'action-icon--spray',
}

export default function TaskPage() {
  const router = useRouter()
  const plotId = Number(router.params.plotId || 0)
  // decodeURIComponent 对非法 UTF-8 序列会抛 URIError, 套 try/catch 兜底
  let plotName = `地块 #${plotId}`
  if (router.params.plotName) {
    try {
      plotName = decodeURIComponent(router.params.plotName)
    } catch {
      plotName = router.params.plotName
    }
  }

  const [actions, setActions] = useState<AllowedAction[]>([])
  const [quota, setQuota] = useState<{
    limit: number | null
    used: number | null
    remaining: number | null
  }>({ limit: null, used: null, remaining: null })
  const [tasks, setTasks] = useState<OperationTaskListItem[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [openingLive, setOpeningLive] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // 表单弹层
  const [selected, setSelected] = useState<AllowedAction | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [dispatchMode, setDispatchMode] = useState<'auto' | 'direct_operator'>('auto')
  const [directOperatorReason, setDirectOperatorReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formErr, setFormErr] = useState('')
  // H2 · idempotencyKey 绑 openForm 生命周期, 同一次填表的多次重试共享 key
  //      (网络抖动后后端可能已落地, 新 key 会导致重复创建)
  const [formKey, setFormKey] = useState<string>('')

  // M4 · ref 瞬时锁: 比 state 早一帧生效, 兑提极快双击
  const submittingRef = useRef(false)
  const openingLiveRef = useRef(false)
  // refreshAll 代际守卫: 并发下拉/手动刷新时, 只让最后一次的结果落 state
  const refreshSeqRef = useRef(0)
  // FIX · 提交成功后有 800ms 跳转延时. 若用户期间 navigateBack, 计时器仍会
  //   触发 navigateTo 把 task-detail 推到栈顶 (错位). 用 ref 存 timer id,
  //   useUnload 清理.
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // G1 · usePageRefresh 管 useLoad + useDidShow (自动跳首次 show, 避免双拉).
  //      从 task-detail navigateBack 返回时自动刷新任务列表.
  usePageRefresh(() => {
    // 预条件: 无 token → 登录页; 无 plotId → 提示并跳过
    const token = useAuthStore.getState().token
    if (!token) {
      Taro.redirectTo({ url: '/pages/login/index' })
      return
    }
    if (!plotId) {
      Taro.showToast({ title: '参数缺失: plotId', icon: 'none' })
      return
    }
    refreshAll()
  })

  useUnload(() => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }
  })

  usePullDownRefresh(() => {
    refreshAll().finally(() => Taro.stopPullDownRefresh())
  })

  async function refreshAll() {
    const seq = ++refreshSeqRef.current
    setLoading(true)
    setErr('')
    try {
      // cameras 是软依赖: 没权限 / 没摄像头时整块隐藏, 不阻塞主流程
      //   FIX · 原先用 getMyOperationTasks (拉全部 task 再客户端 filter plotId),
      //         当用户跨地块任务 > 30 条时, 最新 30 条里可能一条当前地块都没有,
      //         界面错显 "暂无任务". 改用 /plots/{id}/operation-logs 服务端按
      //         plotId 过滤, 语义和分页都更准确.
      const [actionRes, pageRes, cameraRes] = await Promise.all([
        getAllowedActions(plotId),
        getOperationLogs(plotId, 1, 30),
        getCameraList(plotId).catch(() => [] as Camera[]),
      ])
      // 代际守卫: 如果期间又触发了新 refresh, 丢弃本次结果
      if (seq !== refreshSeqRef.current) return
      setActions(actionRes.actions || [])
      setQuota({
        limit: actionRes.dailyLimit ?? null,
        used: actionRes.dailyUsed ?? null,
        remaining: actionRes.dailyRemaining ?? null,
      })
      setTasks(pageRes.list || [])
      setCameras(cameraRes || [])
    } catch (e) {
      if (seq !== refreshSeqRef.current) return
      setErr(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (seq === refreshSeqRef.current) setLoading(false)
    }
  }

  /**
   * 跳摄像头页 · 默认快照模式 (查看现场画面 / 30s 自动刷新)
   *  · miniapp 不直接播 RTMP/FLV 流, 因为小程序 <live-player> 受类目限制
   *    + <web-view> 要备案 HTTPS 业务域名, 短期内成本高
   *  · 实时画面走管理端大屏 / admin-next 浏览器 flv.js, 体验更好
   *  · 此处仅传 cameraId + cameraName, camera 页自己拉 snapshot 轮询
   */
  function openCameraSnapshot(cam: Camera) {
    if (openingLiveRef.current) return
    openingLiveRef.current = true
    setOpeningLive(cam.cameraId)
    try {
      const qs = new URLSearchParams({
        cameraId: String(cam.cameraId),
        cameraName: cam.cameraName || `摄像头 #${cam.cameraId}`,
        mode: 'snapshot',
      }).toString()
      Taro.navigateTo({ url: `/pages/camera/index?${qs}` })
    } finally {
      // navigateTo 异步, 这里不等结果, 下一帧自然清掉
      setTimeout(() => {
        setOpeningLive(null)
        openingLiveRef.current = false
      }, 600)
    }
  }

  function openForm(action: AllowedAction) {
    if (!action.enabled || !action.deviceId) return
    setSelected(action)
    // 预填默认值
    const defaults: Record<string, string> = {}
    action.requiredParams.forEach((p) => {
      if (p === 'durationMinutes') defaults[p] = '5'
    })
    setFormValues(defaults)
    setDispatchMode('auto')
    setDirectOperatorReason('')
    setFormErr('')
    // H2 · 用户打开表单 = 一次意图, 就此确定幂等 key; 后续重试不换 key
    setFormKey(genIdempotencyKey())
  }

  function closeForm() {
    setSelected(null)
    setFormValues({})
    setDispatchMode('auto')
    setDirectOperatorReason('')
    setFormErr('')
    setFormKey('')
  }

  function handleInput(name: string, value: string) {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  async function submitForm() {
    if (!selected || !selected.deviceId) return
    // M4 · ref 锁兑提极快双击
    if (submittingRef.current) return

    // 本地验证: 所有必填非空 + durationMinutes 数字范围
    for (const p of selected.requiredParams) {
      const v = (formValues[p] || '').trim()
      if (!v) {
        setFormErr(`请填写: ${labelOf(p)}`)
        return
      }
      if (p === 'durationMinutes') {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 1 || n > 120) {
          setFormErr('持续时长必须在 1 ~ 120 分钟')
          return
        }
      }
    }

    // H2 · 正常情况 openForm 已绑定 key, 兼容旧流程兄弟入口时兽处理
    const idempotencyKey = formKey || genIdempotencyKey()

    submittingRef.current = true
    setSubmitting(true)
    setFormErr('')
    try {
      // 组装 actionParams: 数字字段转 number
      const actionParams: Record<string, unknown> = {}
      for (const p of [...selected.requiredParams, ...selected.optionalParams]) {
        const v = (formValues[p] || '').trim()
        if (v === '') continue
        actionParams[p] =
          p === 'durationMinutes' ||
          p === 'waterVolumeLiters' ||
          p === 'flowRate' ||
          p === 'concentrationPercent' ||
          p === 'volumeLiters' ||
          p === 'pressureBar'
            ? Number(v)
            : v
      }

      const res = await createOperationTask({
        plotId,
        deviceId: selected.deviceId,
        actionType: selected.actionType,
        actionParams,
        schedulingMode: 'asap',
        idempotencyKey,
        dispatchMode,
        directOperatorReason: dispatchMode === 'direct_operator' ? directOperatorReason.trim() : undefined,
      })

      Taro.showToast({
        title: `任务 ${res.taskNo} 已提交`,
        icon: 'success',
        duration: 1200,
      })
      closeForm()
      // 刷新列表 + 跳详情 · 用 ref 存 timer, 页面 unload 时清理, 避免导航错位
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null
        Taro.navigateTo({ url: `/pages/task-detail/index?taskId=${res.taskId}` })
      }, 800)
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const hasAnyEnabled = useMemo(() => actions.some((a) => a.enabled), [actions])
  const taskOverview = useMemo(() => {
    const running = tasks.filter((t) => t.taskStatus === 'running').length
    const queued = tasks.filter((t) => t.taskStatus === 'queued').length
    const pending = tasks.filter((t) => t.taskStatus === 'pending').length
    return `当前地块任务：执行中 ${running} · 排队 ${queued} · 待处理 ${pending}`
  }, [tasks])

  return (
    <View className='task-page'>
      {/* --- 页头 --- */}
      <View className='task-head'>
        <Text className='task-head__seal'>§ 03 · 操作申请</Text>
        <Text className='task-head__title'>{plotName}</Text>
        <Text className='task-head__lede'>
          — 远程申请浇水/施肥/喷淋, 由调度中心决定执行顺序与时机.
        </Text>
        <Text className='task-head__state'>{taskOverview}</Text>
      </View>

      {err ? <Text className='task-page__err'>{err}</Text> : null}

      {/* --- 摄像头 (软依赖, 无权限/无设备时整块隐藏) --- */}
      {cameras.length > 0 ? (
        <View className='task-section'>
          <Text className='task-section__title'>现场画面</Text>
          <View className='camera-list'>
            {cameras.map((cam) => {
              const online = cam.networkStatus === 'online'
              const isOpening = openingLive === cam.cameraId
              return (
                <View
                  key={cam.cameraId}
                  className={`camera-card ${online ? '' : 'camera-card--offline'}`}
                  onClick={() => openCameraSnapshot(cam)}
                >
                  <View className='camera-card__frame'>
                    {cam.snapshotUrl ? (
                      <Image
                        className='camera-card__img'
                        src={cam.snapshotUrl}
                        mode='aspectFill'
                        lazyLoad
                      />
                    ) : (
                      <View className='camera-card__placeholder'>
                        <Text>— 暂无快照 —</Text>
                      </View>
                    )}
                    <View className='camera-card__badges'>
                      <Text
                        className={`camera-card__status ${
                          online ? 'camera-card__status--on' : 'camera-card__status--off'
                        }`}
                      >
                        {online ? '● ONLINE' : '● OFFLINE'}
                      </Text>
                    </View>
                  </View>
                  <View className='camera-card__foot'>
                    <View className='camera-card__meta'>
                      <Text className='camera-card__name'>
                        {cam.cameraName || `摄像头 #${cam.cameraId}`}
                      </Text>
                      <Text className='camera-card__no'>{cam.deviceNo}</Text>
                    </View>
                    <Text className='camera-card__cta'>
                      {isOpening ? '载入中…' : '查看大图 →'}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
          <Text className='task-hint'>
            · 此处展示快照, 自动每 30 秒更新一次
          </Text>
          <Text className='task-hint'>
            · 实时直播画面请使用「管理端大屏」或 PC 浏览器观看
          </Text>
        </View>
      ) : null}

      {/* --- 动作按钮 --- */}
      <View className='task-section'>
        <Text className='task-section__title'>可执行操作</Text>

        {/* 今日操作配额 · 让用户清楚知道还能浇几次 */}
        {quota.limit != null && quota.limit > 0 ? (
          <View
            className={`task-quota task-quota--${
              (quota.remaining ?? 0) <= 0
                ? 'empty'
                : (quota.remaining ?? 0) <= 1
                ? 'low'
                : 'ok'
            }`}
          >
            <View className='task-quota__row'>
              <Text className='task-quota__key'>今日操作</Text>
              <Text className='task-quota__val'>
                {quota.used ?? 0} / {quota.limit} 次
              </Text>
            </View>
            <View className='task-quota__bar'>
              <View
                className='task-quota__bar-fill'
                style={{
                  width: `${Math.min(100, ((quota.used ?? 0) / quota.limit) * 100)}%`,
                }}
              />
            </View>
            <Text className='task-quota__hint'>
              {(quota.remaining ?? 0) <= 0
                ? '今日额度已用完, 明天 0 点重置'
                : `今日还能操作 ${quota.remaining} 次 · 含浇水/施肥/喷雾合计`}
            </Text>
          </View>
        ) : null}

        {actions.length === 0 && !loading ? (
          <Text className='task-empty'>暂无可用操作</Text>
        ) : null}

        <View className='action-grid'>
          {actions.map((action) => {
            const iconClass = ACTION_ICON[action.actionType] || 'action-icon--default'
            return (
              <View
                key={action.actionType}
                className={`action-card ${action.enabled ? '' : 'action-card--disabled'}`}
                onClick={() => openForm(action)}
              >
                <View className={`action-icon ${iconClass}`} />
                <View className='action-card__info'>
                  <Text className='action-card__name'>{action.actionName}</Text>
                  {!action.enabled && action.reason ? (
                    <Text className='action-card__reason'>{action.reason}</Text>
                  ) : (
                    <Text className='action-card__device'>
                      {action.deviceName || '默认设备'}
                    </Text>
                  )}
                </View>
                <Text className='action-card__arrow'>{action.enabled ? '→' : '·'}</Text>
              </View>
            )
          })}
        </View>

        {!hasAnyEnabled && actions.length > 0 ? (
          <Text className='task-hint'>
            · 该地块当前无可用操作 (检查是否在操作时段内 · 兑换码是否允许)
          </Text>
        ) : null}
      </View>

      {/* --- 任务列表 --- */}
      <View className='task-section'>
        <Text className='task-section__title'>本地块近期任务</Text>
        {tasks.length === 0 ? (
          <Text className='task-empty'>{loading ? '加载中...' : '暂无任务记录'}</Text>
        ) : (
          <View className='task-list'>
            {tasks.map((task) => {
              const statusInfo = TASK_STATUS_LABEL[task.taskStatus] || {
                text: task.taskStatus,
                tone: 'ink-faint',
              }
              return (
                <View
                  key={task.taskId}
                  className='task-card'
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/task-detail/index?taskId=${task.taskId}`,
                    })
                  }
                >
                  <View className='task-card__head'>
                    <Text className='task-card__name'>{task.actionName}</Text>
                    <Text className='task-card__no'>
                      T-…{task.taskNo.slice(-6)}
                    </Text>
                  </View>
                  <View className='task-card__meta'>
                    <Text className='task-card__time'>{task.createdAt}</Text>
                    {task.queueNo ? (
                      <Text className='task-card__queue'>· 排队 #{task.queueNo}</Text>
                    ) : null}
                  </View>
                  <Text className={`task-badge task-badge--${statusInfo.tone}`}>
                    {statusInfo.text}
                  </Text>
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* --- 底部 sheet · mask 和 sheet 兄弟节点 ---
       * 不能用 `e.stopPropagation()`: Taro miniapp 的 event 对象没这 API,
       * 点击冒泡要靠编译期 `catch:tap`, 不是运行时调用. 解法: 把 mask
       * 和 sheet 并列, sheet 自己 position:fixed + 更高 z-index 接住点击.
       */}
      {selected ? (
        <>
          <View className='sheet-mask' onClick={closeForm} />
          <View className='sheet'>
            <View className='sheet__head'>
              <Text className='sheet__title'>{selected.actionName}</Text>
              <Text className='sheet__close' onClick={closeForm}>
                ×
              </Text>
            </View>
            <Text className='sheet__device'>
              执行设备: {selected.deviceName || `#${selected.deviceId}`}
            </Text>

            <View className='sheet__form'>
              <View className='form-item'>
                <Text className='form-item__label'>任务流转</Text>
                <View className='dispatch-switch'>
                  <View
                    className={`dispatch-switch__item ${dispatchMode === 'auto' ? 'dispatch-switch__item--active' : ''}`}
                    onClick={() => setDispatchMode('auto')}
                  >
                    正常提交
                  </View>
                  <View
                    className={`dispatch-switch__item ${dispatchMode === 'direct_operator' ? 'dispatch-switch__item--active' : ''}`}
                    onClick={() => setDispatchMode('direct_operator')}
                  >
                    交由运营处理
                  </View>
                </View>
                <Text className='form-item__hint'>
                  {dispatchMode === 'direct_operator'
                    ? '该任务会直接进入运营审核队列，不会自动调度执行'
                    : '系统按既有策略自动调度，命中风险时才进入运营审核'}
                </Text>
              </View>

              {dispatchMode === 'direct_operator' ? (
                <View className='form-item'>
                  <Text className='form-item__label form-item__label--opt'>给运营备注 (可选)</Text>
                  <Input
                    className='form-item__input'
                    type='text'
                    value={directOperatorReason}
                    placeholder='例如: 今天地块偏干，请优先处理'
                    maxlength={80}
                    onInput={(e: { detail: { value: string } }) => setDirectOperatorReason(e.detail.value)}
                  />
                </View>
              ) : null}

              {selected.requiredParams.map((p) => (
                <View key={p} className='form-item'>
                  <Text className='form-item__label'>
                    {labelOf(p)} <Text className='form-item__req'>*</Text>
                  </Text>
                  <Input
                    className='form-item__input'
                    type={numberParams.has(p) ? 'number' : 'text'}
                    value={formValues[p] || ''}
                    placeholder={hintOf(p)}
                    maxlength={numberParams.has(p) ? 8 : 100}
                    onInput={(e: { detail: { value: string } }) =>
                      handleInput(p, e.detail.value)
                    }
                  />
                </View>
              ))}
              {selected.optionalParams.map((p) => (
                <View key={p} className='form-item'>
                  <Text className='form-item__label form-item__label--opt'>
                    {labelOf(p)} (可选)
                  </Text>
                  <Input
                    className='form-item__input'
                    type={numberParams.has(p) ? 'number' : 'text'}
                    value={formValues[p] || ''}
                    placeholder={hintOf(p)}
                    maxlength={numberParams.has(p) ? 8 : 100}
                    onInput={(e: { detail: { value: string } }) =>
                      handleInput(p, e.detail.value)
                    }
                  />
                </View>
              ))}
            </View>

            {formErr ? <Text className='sheet__err'>{formErr}</Text> : null}

            <Button
              className='sheet__submit'
              loading={submitting}
              disabled={submitting}
              onClick={submitForm}
            >
              <Text>{submitting ? '提交中' : '提交申请'}</Text>
            </Button>

            <Text className='sheet__foot'>
              · 任务创建后由调度中心执行, 状态可在"本地块近期任务"里追踪
            </Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

// ---- 参数名 → 中文 label ----
const PARAM_LABEL: Record<string, string> = {
  durationMinutes: '持续时长 (分钟)',
  waterVolumeLiters: '水量 (升)',
  flowRate: '流量',
  fertilizerType: '肥料类型',
  concentrationPercent: '浓度 (%)',
  volumeLiters: '体积 (升)',
  sprayType: '喷淋类型',
  pressureBar: '压力 (bar)',
}
function labelOf(param: string): string {
  return PARAM_LABEL[param] || param
}

const PARAM_HINT: Record<string, string> = {
  durationMinutes: '1 - 120 分钟',
  waterVolumeLiters: '例: 50',
  flowRate: '例: 10',
  fertilizerType: '例: 尿素 / NPK 20-20-20',
  concentrationPercent: '0 - 100',
  volumeLiters: '例: 20',
  sprayType: '例: 清水 / 叶面肥',
  pressureBar: '例: 2.5',
}
function hintOf(param: string): string {
  return PARAM_HINT[param] || ''
}

const numberParams = new Set([
  'durationMinutes',
  'waterVolumeLiters',
  'flowRate',
  'concentrationPercent',
  'volumeLiters',
  'pressureBar',
])
