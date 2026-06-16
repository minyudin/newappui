import { useEffect, useRef, useState } from 'react'
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
import { listUsers, createUser, checkNicknameAvailability, updateUserNickname } from '@/api'
import { qk } from '@/lib/queryKeys'
import { toast } from '@/lib/toast'
import RowLead from '@/components/table/RowLead'
import type { AdminUser, PageQuery, RoleType } from '@/types/api'

/**
 * §2 Users · 用户管理
 * ============================================================
 *  对齐 longarch-admin/src/views/Users.vue
 *  · 筛选: roleType + keyword
 *  · 列表: userId / userNo / nickname / realName / mobile / roleType / status / createdAt
 *  · 新建: openId + nickname + roleType (default adopter)
 * ============================================================ */

const ROLE_OPTIONS: { value: RoleType; cn: string; en: string }[] = [
  { value: 'admin',      cn: '管理员',   en: 'Director' },
  { value: 'adopter',    cn: '认养用户', en: 'Adopter' },
  { value: 'operator',   cn: '运营人员', en: 'Operator' },
  { value: 'agronomist', cn: '农技人员', en: 'Agronomist' },
]

function roleLabel(r: string) {
  if (r === 'guest') return '游客'
  return ROLE_OPTIONS.find((o) => o.value === r)?.cn ?? r
}

function roleTone(r: string): 'plum' | 'fog' | 'moss' | 'sand' | 'neutral' {
  switch (r) {
    case 'admin':      return 'plum'
    case 'operator':   return 'fog'
    case 'agronomist': return 'moss'
    case 'adopter':    return 'sand'
    case 'guest':      return 'fog'
    default:           return 'neutral'
  }
}

const ALL_ROLE = '__all__'

/** 把 19 位雪花 userNo 缩写为 Uxxxxxx (末 6 位) */
function shortUserNo(no?: string) {
  if (!no) return '—'
  return no.length > 10 ? `${no.slice(0, 1)}…${no.slice(-6)}` : no
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<PageQuery & { roleType: string; keyword: string }>(
    { pageNo: 1, pageSize: 10, roleType: '', keyword: '' },
  )
  const [localKeyword, setLocalKeyword] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery((q) => ({ ...q, keyword: localKeyword, pageNo: 1 }))
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [localKeyword])

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ openId: string; nickname: string; roleType: RoleType }>(
    { openId: '', nickname: '', roleType: 'adopter' },
  )
  // 昵称可用性检查状态 (与 miniapp setup-nickname 同样的 4 态)
  const [nickState, setNickState] = useState<'idle' | 'checking' | 'ok' | 'invalid'>('idle')
  const [nickHint, setNickHint] = useState<string>('')
  const nickDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nickSeqRef = useRef(0)

  // 详情对话框 · admin 强改某个用户的昵称 (用同一套校验状态机, 但独立 ref)
  const [editingNick, setEditingNick] = useState(false)
  const [editNick, setEditNick] = useState('')
  const [editNickState, setEditNickState] = useState<'idle' | 'checking' | 'ok' | 'invalid'>('idle')
  const [editNickHint, setEditNickHint] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const editNickDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editNickSeqRef = useRef(0)

  const params: PageQuery = { pageNo: query.pageNo, pageSize: query.pageSize }
  if (query.roleType) params.roleType = query.roleType
  if (query.keyword) params.keyword = query.keyword
  const { data, isPending: loading, isError, refetch } = useQuery({
    queryKey: qk.users.list(params),
    queryFn: () => listUsers(params),
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  async function handleCreate() {
    if (!form.openId.trim() || !form.nickname.trim()) {
      toast.warning('openId 与昵称均为必填')
      return
    }
    if (nickState === 'invalid') {
      toast.warning(nickHint || '昵称不合规, 请修改后再提交')
      return
    }
    setCreating(true)
    try {
      // stub 模式对齐: wechatLogin 会写 open_id = `stub_` + code,
      // 这里提交前统一补齐, 避免管理端创建的用户和 miniapp 登录时的用户对不上.
      // 已经手输 stub_ / wx_ 前缀的幂等跳过.
      const rawOpenId = form.openId.trim()
      const normalizedOpenId =
        rawOpenId.startsWith('stub_') || rawOpenId.startsWith('wx_')
          ? rawOpenId
          : `stub_${rawOpenId}`
      await createUser({
        openId: normalizedOpenId,
        nickname: form.nickname.trim(),
        roleType: form.roleType,
      })
      toast.success('创建成功')
      setShowCreate(false)
      setForm({ openId: '', nickname: '', roleType: 'adopter' })
      setNickState('idle')
      setNickHint('')
      setQuery((q) => ({ ...q, pageNo: 1 }))
      queryClient.invalidateQueries({ queryKey: qk.users.all() })
    } catch {
      // interceptor toasts
    } finally {
      setCreating(false)
    }
  }

  /** 昵称输入实时检查 · 600ms 防抖 · 与 miniapp setup-nickname 同规则 */
  function onNicknameChange(v: string) {
    setForm((f) => ({ ...f, nickname: v }))
    setNickState('idle')
    setNickHint('')
    if (nickDebounceRef.current) clearTimeout(nickDebounceRef.current)

    const trimmed = v.trim()
    if (!trimmed) return
    // 客户端预校验快速失败
    const cp = [...trimmed].length
    if (cp < 2) {
      setNickState('invalid')
      setNickHint('昵称至少 2 个字符')
      return
    }
    if (cp > 16) {
      setNickState('invalid')
      setNickHint('昵称不能超过 16 个字符')
      return
    }
    if (!/^[\p{L}\p{N}_ ]+$/u.test(trimmed)) {
      setNickState('invalid')
      setNickHint('昵称仅支持中英文/数字/下划线/空格')
      return
    }
    if (/^(用户|游客)\d{4,8}$/.test(trimmed)) {
      setNickState('invalid')
      setNickHint('请勿使用系统默认昵称格式')
      return
    }

    setNickState('checking')
    nickDebounceRef.current = setTimeout(() => {
      const seq = ++nickSeqRef.current
      checkNicknameAvailability(trimmed)
        .then((res) => {
          if (seq !== nickSeqRef.current) return
          if (res.available) {
            setNickState('ok')
            setNickHint(res.normalized && res.normalized !== trimmed
              ? `将保存为: ${res.normalized}` : '可用')
          } else {
            setNickState('invalid')
            setNickHint(res.reason || '昵称不可用')
          }
        })
        .catch(() => {
          // 网络错放过, 让后端兜底
          if (seq !== nickSeqRef.current) return
          setNickState('idle')
          setNickHint('')
        })
    }, 600)
  }

  /** 详情对话框 · admin 改某用户昵称 输入框实时检查 */
  function onEditNickChange(v: string) {
    setEditNick(v)
    setEditNickState('idle')
    setEditNickHint('')
    if (editNickDebounceRef.current) clearTimeout(editNickDebounceRef.current)

    const trimmed = v.trim()
    if (!trimmed) return
    const cp = [...trimmed].length
    if (cp < 2) { setEditNickState('invalid'); setEditNickHint('昵称至少 2 个字符'); return }
    if (cp > 16) { setEditNickState('invalid'); setEditNickHint('昵称不能超过 16 个字符'); return }
    if (!/^[\p{L}\p{N}_ ]+$/u.test(trimmed)) {
      setEditNickState('invalid'); setEditNickHint('昵称仅支持中英文/数字/下划线/空格'); return
    }
    if (/^(用户|游客)\d{4,8}$/.test(trimmed)) {
      setEditNickState('invalid'); setEditNickHint('请勿使用系统默认昵称格式'); return
    }
    if (detailUser && trimmed === (detailUser.nickname ?? '')) {
      setEditNickState('ok'); setEditNickHint('与当前昵称相同 (幂等)'); return
    }

    setEditNickState('checking')
    editNickDebounceRef.current = setTimeout(() => {
      const seq = ++editNickSeqRef.current
      checkNicknameAvailability(trimmed)
        .then((res) => {
          if (seq !== editNickSeqRef.current) return
          if (res.available) {
            setEditNickState('ok')
            setEditNickHint(res.normalized && res.normalized !== trimmed
              ? `将保存为: ${res.normalized}` : '可用')
          } else {
            setEditNickState('invalid')
            setEditNickHint(res.reason || '昵称不可用')
          }
        })
        .catch(() => {
          if (seq !== editNickSeqRef.current) return
          setEditNickState('idle'); setEditNickHint('')
        })
    }, 600)
  }

  function startEditNick() {
    if (!detailUser) return
    setEditNick(detailUser.nickname ?? '')
    setEditNickState('idle')
    setEditNickHint('')
    setEditingNick(true)
  }

  function cancelEditNick() {
    setEditingNick(false)
    setEditNick('')
    setEditNickState('idle')
    setEditNickHint('')
    if (editNickDebounceRef.current) clearTimeout(editNickDebounceRef.current)
  }

  async function submitEditNick() {
    if (!detailUser) return
    if (editNickState === 'invalid') {
      toast.warning(editNickHint || '昵称不合规')
      return
    }
    const trimmed = editNick.trim()
    if (!trimmed) {
      toast.warning('昵称不能为空')
      return
    }
    setEditSubmitting(true)
    try {
      const fresh = await updateUserNickname(detailUser.userId, trimmed)
      toast.success('昵称已更新')
      setDetailUser({ ...detailUser, nickname: fresh.nickname })
      setEditingNick(false)
      queryClient.invalidateQueries({ queryKey: qk.users.all() })
    } catch {
      // interceptor toasts
    } finally {
      setEditSubmitting(false)
    }
  }

  return (
    <PageShell
      seal="§2 · People"
      title="Users"
      titleCn="用 户"
      lede="Who lives in this system. Admins, operators, adopters."
      right={
        <>
          <span>{total} ENTRIES</span>
          <span>·</span>
          <span>PAGE {String(query.pageNo).padStart(2, '0')}</span>
        </>
      }
    >
      {/* ==== §2.1 Filter bar + Create ==== */}
      <section
        className="folio-page__section flex !flex-row flex-wrap items-end justify-between gap-3"
        data-testid="users-filter"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="users-filter-role">ROLE</Label>
            <Select
              value={query.roleType || ALL_ROLE}
              onValueChange={(v) =>
                setQuery((q) => ({ ...q, roleType: v === ALL_ROLE ? '' : v, pageNo: 1 }))
              }
            >
              <SelectTrigger id="users-filter-role" className="w-[180px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLE}>全部 · All roles</SelectItem>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.cn} · {r.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 min-w-[200px] max-w-[320px]">
            <Label htmlFor="users-filter-keyword">KEYWORD</Label>
            <Input
              id="users-filter-keyword"
              value={localKeyword}
              onChange={(e) => setLocalKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  setQuery((q) => ({ ...q, keyword: localKeyword, pageNo: 1 }))
                }
              }}
              placeholder="nickname / realName / mobile"
            />
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              setQuery((q) => ({ ...q, keyword: localKeyword, pageNo: 1 }))
            }}
            data-testid="users-search"
          >
            搜索 Search
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setLocalKeyword('')
              setQuery({ pageNo: 1, pageSize: query.pageSize ?? 10, roleType: '', keyword: '' })
            }}
          >
            重置
          </Button>
        </div>

        <Dialog
          open={showCreate}
          onOpenChange={(open) => {
            setShowCreate(open)
            if (!open) {
              // 关闭对话框时重置表单 + 昵称检查状态, 避免下次打开还残留上次的 hint
              setForm({ openId: '', nickname: '', roleType: 'adopter' })
              setNickState('idle')
              setNickHint('')
              if (nickDebounceRef.current) clearTimeout(nickDebounceRef.current)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="primary" data-testid="users-create-trigger">
              + 新建用户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogSeal>§ FORM · new user</DialogSeal>
              <DialogTitle>新建用户</DialogTitle>
              <DialogDescription>
                Create a folio entry for a new person.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="users-create-openid">OPENID *</Label>
                  <Input
                    id="users-create-openid"
                    value={form.openId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, openId: e.target.value }))
                    }
                    placeholder="输入 stub deviceId, 如 ad_001 / kiro_ad_001"
                  />
                  <span className="font-sans text-[11px] text-ink-faint">
                    此 ID 将作为 miniapp 的 stub code · 提交时自动补 <code className="font-folio">stub_</code> 前缀。
                    <br />生产用户应通过微信登录自动创建,这里仅用于 dev 开 stub 账号或 operator/agronomist 等内部账号。
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="users-create-nickname">NICKNAME *</Label>
                  <Input
                    id="users-create-nickname"
                    value={form.nickname}
                    onChange={(e) => onNicknameChange(e.target.value)}
                    placeholder="2~16 字符 · 中英数/下划线/空格"
                    maxLength={16}
                    data-state={nickState}
                  />
                  {nickHint ? (
                    <span
                      className={`font-folio text-[11px] ${
                        nickState === 'invalid'
                          ? 'text-clay'
                          : nickState === 'ok'
                          ? 'text-sage'
                          : 'text-ink-soft'
                      }`}
                      data-testid="users-create-nickname-hint"
                    >
                      {nickState === 'checking' ? '检查中…' : nickHint}
                    </span>
                  ) : (
                    <span className="font-sans text-[11px] text-ink-faint">
                      昵称全平台唯一,与 miniapp 用户共用唯一空间。
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="users-create-role">ROLE *</Label>
                  <Select
                    value={form.roleType}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, roleType: v as RoleType }))
                    }
                  >
                    <SelectTrigger id="users-create-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.cn} · {r.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                data-testid="users-create-submit"
              >
                {creating ? '创建中...' : '确定'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* ==== §2.2 Table ==== */}
      <section className="folio-page__section" data-testid="users-table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">User</TableHead>
                <TableHead className="min-w-[120px]">Real Name</TableHead>
                <TableHead className="w-[130px]">Mobile</TableHead>
                <TableHead className="w-[100px]">Role</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[150px]">Created</TableHead>
                <TableHead className="w-[88px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u, idx) => {
                const rowSeal = `§${String(((query.pageNo ?? 1) - 1) * (query.pageSize ?? 10) + idx + 1).padStart(2, '0')}`
                const isActive = u.status === 1
                return (
                <TableRow key={u.userId} className="row-fx">
                  <TableCell className="text-[13px]">
                    <RowLead
                      seal={rowSeal}
                      primary={u.nickname ?? '—'}
                      secondary={shortUserNo(u.userNo)}
                      title={u.userNo}
                    />
                  </TableCell>
                  <TableCell className="text-[13px] text-ink">
                    {u.realName ? u.realName : <span className="text-ink-faint">—</span>}
                  </TableCell>
                  <TableCell className="font-folio text-[12px] text-ink">
                    {u.mobile ?? <span className="text-ink-faint">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge tone={roleTone(u.roleType)}>{roleLabel(u.roleType)}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="row-fx__dot" data-tone={isActive ? 'sage' : 'clay'} />
                      <Badge tone={isActive ? 'sage' : 'clay'}>
                        {isActive ? '在用' : '已禁用'}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="font-folio text-[11px] text-ink-soft">
                    {u.createdAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 font-folio text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink"
                      data-testid="users-detail"
                      data-user-id={u.userId}
                      onClick={() => setDetailUser(u)}
                    >
                      详情 Detail
                    </Button>
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {isError && <TableError onRetry={() => refetch()} />}
          {!isError && list.length === 0 && !loading && (
            <TableEmpty>No users matching the current filter.</TableEmpty>
          )}
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

      <Dialog
        open={detailUser != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailUser(null)
            // 关闭详情对话框时重置编辑态, 防止下次打开还残留
            setEditingNick(false)
            setEditNick('')
            setEditNickState('idle')
            setEditNickHint('')
            if (editNickDebounceRef.current) clearTimeout(editNickDebounceRef.current)
          }
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogSeal>§ LOOKUP · user</DialogSeal>
            <DialogTitle>用户详情</DialogTitle>
            <DialogDescription>
              Folio record for this account. Values mirror the list API payload.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detailUser ? (
              <dl className="grid grid-cols-[minmax(0,120px)_1fr] gap-x-4 gap-y-3 text-[13px]">
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">userId</dt>
                <dd className="font-folio text-ink break-all">{detailUser.userId}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">userNo</dt>
                <dd className="font-folio text-ink break-all">{detailUser.userNo || '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">openId</dt>
                <dd className="font-folio text-[12px] text-ink break-all">{detailUser.openId || '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">nickname</dt>
                <dd className="text-ink">
                  {editingNick ? (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        value={editNick}
                        onChange={(e) => onEditNickChange(e.target.value)}
                        placeholder="2~16 字符 · 中英数/下划线/空格"
                        maxLength={16}
                        data-state={editNickState}
                        autoFocus
                      />
                      {editNickHint ? (
                        <span
                          className={`font-folio text-[11px] ${
                            editNickState === 'invalid'
                              ? 'text-clay'
                              : editNickState === 'ok'
                              ? 'text-sage'
                              : 'text-ink-soft'
                          }`}
                          data-testid="users-detail-nickname-hint"
                        >
                          {editNickState === 'checking' ? '检查中…' : editNickHint}
                        </span>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          className="h-8 px-3 text-[12px]"
                          onClick={submitEditNick}
                          disabled={editSubmitting || editNickState === 'invalid'}
                          data-testid="users-detail-nickname-submit"
                        >
                          {editSubmitting ? '保存中…' : '保存'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-3 text-[12px]"
                          onClick={cancelEditNick}
                          disabled={editSubmitting}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{detailUser.nickname ?? '—'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 px-2 font-folio text-[11px] uppercase tracking-wider text-ink-faint hover:text-ink"
                        onClick={startEditNick}
                        data-testid="users-detail-nickname-edit"
                      >
                        修改 →
                      </Button>
                    </div>
                  )}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">realName</dt>
                <dd className="text-ink">{detailUser.realName?.trim() ? detailUser.realName : '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">mobile</dt>
                <dd className="font-folio text-ink">{detailUser.mobile ?? '—'}</dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">roleType</dt>
                <dd>
                  <Badge tone={roleTone(detailUser.roleType)}>{roleLabel(detailUser.roleType)}</Badge>
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">status</dt>
                <dd>
                  <Badge tone={detailUser.status === 1 ? 'sage' : 'clay'}>
                    {detailUser.status === 1 ? '在用' : '已禁用'}
                  </Badge>
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">bindMobile</dt>
                <dd className="text-ink">
                  {detailUser.bindMobile === 1 ? '已绑定手机号' : '未绑定'}
                </dd>
                <dt className="font-folio text-[10px] uppercase tracking-wider text-ink-faint">createdAt</dt>
                <dd className="font-folio text-[12px] text-ink-soft">{detailUser.createdAt ?? '—'}</dd>
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
