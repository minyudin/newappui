import * as React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogSeal,
  DialogBody,
  DialogFooter,
  DialogClose,
  Button,
  Input,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { PaginatedList, PageQuery } from '@/types/api'

/**
 * SearchableSelect · 可搜索下拉 (管理端认养流程专用)
 * ============================================================
 *  背景:
 *    原生 Input 让管理员手输 `plotId` / `userId` / `orderId` 数字,
 *    常要肉眼去另一页找 ID 再回来填, 跨页记忆 + 易错.
 *  方案:
 *    - Trigger 看起来像普通 Input, 显示当前选中项的"人读名字 (·#id)"
 *    - 点击弹 Dialog picker: 顶上搜索框, 下面结果列表, 点一条关闭并返回 id
 *    - 数据通过 fetchList 注入 (PaginatedList<T>), 用 useQuery 缓存 (keepPrevious)
 *    - Dialog 关闭前延迟卸载列表, 避免关闭瞬间 flicker
 * ============================================================ */

export interface SearchableSelectProps<T> {
  /** 当前值 (通常是 id 的字符串形式, 空串=未选) */
  value: string
  /** 值变化回调 · 新值 + 选中实体 (清空时为 null) */
  onChange: (nextValue: string, item: T | null) => void
  /** 拉取列表的方法 · 将接收 PageQuery (含 pageNo/pageSize + 搜索关键字字段) */
  fetchList: (params: PageQuery) => Promise<PaginatedList<T>>
  /** react-query key 前缀, 同实体共享缓存 */
  queryKeyPrefix: readonly unknown[]
  /** 取实体的 id 字段 (返回数字或字符串都行) */
  getItemKey: (item: T) => number | string
  /** 主显示文字 (例如地块名) */
  getItemLabel: (item: T) => string
  /** 副显示文字 (可选 · 例如地块编号, 用户手机号, 订单创建时间) */
  getItemSubtitle?: (item: T) => string
  /** Trigger 上未选中时的占位 */
  placeholder?: string
  /** 搜索关键字挂的参数名 · 默认 'keyword' (后端通用 · 忽略当 clientSearch=true) */
  searchParamKey?: string
  /** 搜索去抖 ms · 默认 300 */
  searchDebounceMs?: number
  /** 一次加载条数 · 默认 50 */
  pageSize?: number
  /**
   * 客户端搜索模式 · true 时:
   *   - fetchList 只调一次 (不带 keyword), 结果全部拉回
   *   - 关键字变化仅在内存里过滤, 不再打后端
   *   适合 listPlots / listOrders 这类后端没做 keyword 的端点
   */
  clientSearch?: boolean
  /** clientSearch=true 时必填: 本地过滤谓词 (keyword 已 toLowerCase) */
  clientFilterFn?: (item: T, keywordLower: string) => boolean
  /** Dialog 标题 */
  dialogTitle?: string
  /** Dialog 副标 */
  dialogSeal?: string
  /** 是否允许清空已选 */
  allowClear?: boolean
  /** 禁用 */
  disabled?: boolean
  /** 触发器额外 className */
  className?: string
  /** Input id (配 Label htmlFor) */
  id?: string
  /**
   * 当前已选实体的预读 (可选, 用于首次渲染就能显示选中名字,
   * 否则 Trigger 只能显示 "#id"). 上层若已经手里就有这个实体, 传进来.
   */
  selectedItem?: T | null
}

/**
 * 泛型包装 · TypeScript 对 forwardRef 的泛型支持不好, 直接函数组件
 */
export function SearchableSelect<T>({
  value,
  onChange,
  fetchList,
  queryKeyPrefix,
  getItemKey,
  getItemLabel,
  getItemSubtitle,
  placeholder = '点击选择…',
  searchParamKey = 'keyword',
  searchDebounceMs = 300,
  pageSize = 50,
  clientSearch = false,
  clientFilterFn,
  dialogTitle = '选择',
  dialogSeal,
  allowClear = true,
  disabled = false,
  className,
  id,
  selectedItem,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [rawKeyword, setRawKeyword] = React.useState('')
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('')

  // 关闭时清搜索, 下次打开干净
  React.useEffect(() => {
    if (!open) {
      setRawKeyword('')
      setDebouncedKeyword('')
    }
  }, [open])

  // 去抖搜索 · 边输边查但减压
  React.useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setDebouncedKeyword(rawKeyword.trim()), searchDebounceMs)
    return () => clearTimeout(t)
  }, [rawKeyword, open, searchDebounceMs])

  const baseParams: PageQuery = React.useMemo(() => {
    const p: PageQuery = { pageSize }
    if (!clientSearch && debouncedKeyword) p[searchParamKey] = debouncedKeyword
    return p
  }, [debouncedKeyword, pageSize, searchParamKey, clientSearch])

  const {
    data,
    isPending,
    isFetching,
    isFetchingNextPage,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: [...queryKeyPrefix, 'searchable', baseParams] as const,
    queryFn: ({ pageParam }) => fetchList({ ...baseParams, pageNo: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.pageNo * lastPage.pageSize
      return loaded < lastPage.total ? lastPage.pageNo + 1 : undefined
    },
    enabled: open,
    staleTime: 30_000,
  })

  // 客户端过滤: 只有 clientSearch=true + 有关键字 + 有 filterFn 才过
  const items = React.useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.list) ?? []
    if (!clientSearch || !debouncedKeyword || !clientFilterFn) return raw
    const kw = debouncedKeyword.toLowerCase()
    return raw.filter((it) => clientFilterFn(it, kw))
  }, [data, clientSearch, clientFilterFn, debouncedKeyword])

  const loadedTotal = data?.pages.reduce((sum, page) => sum + page.list.length, 0) ?? 0
  const serverTotal = data?.pages[0]?.total ?? 0

  // Trigger 上的显示文本 · 优先用 selectedItem, 没有就只显 id
  const triggerText = React.useMemo(() => {
    if (!value) return ''
    if (selectedItem) {
      const label = getItemLabel(selectedItem)
      const key = String(getItemKey(selectedItem))
      return label ? `${label}  ·  #${key}` : `#${key}`
    }
    return `#${value}`
  }, [value, selectedItem, getItemLabel, getItemKey])

  function handlePick(item: T) {
    onChange(String(getItemKey(item)), item)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation() // 别打开 Dialog
    onChange('', null)
  }

  return (
    <>
      {/* Trigger · 仿 Input 外观, 左实右虚双态, 带 clear 小叉 */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 border border-line bg-paper px-3 py-2',
          'font-sans text-[13px] text-left',
          'transition-colors',
          'hover:border-sage/60 focus:outline-none focus:border-sage',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          value ? 'text-ink' : 'text-ink-faint',
          className,
        )}
      >
        <span className="truncate">{value ? triggerText : placeholder}</span>
        <span className="flex items-center gap-1 shrink-0">
          {allowClear && value && !disabled ? (
            <span
              role="button"
              aria-label="clear"
              onClick={handleClear}
              className="text-ink-faint hover:text-clay p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 text-ink-faint" />
        </span>
      </button>

      {/* Picker Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(560px,calc(100vw-32px))]">
          <DialogHeader>
            {dialogSeal ? <DialogSeal>{dialogSeal}</DialogSeal> : null}
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
              <Input
                autoFocus
                placeholder="输入关键字过滤…"
                value={rawKeyword}
                onChange={(e) => setRawKeyword(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 结果列表 */}
            <div className="border border-line-soft max-h-[50vh] overflow-auto">
              {isError ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <div className="font-sans text-[13px] text-clay">加载失败</div>
                  <Button variant="ghost" size="sm" onClick={() => refetch()}>
                    重试
                  </Button>
                </div>
              ) : isPending ? (
                <div className="font-sans text-[13px] text-ink-faint py-10 text-center">
                  加载中…
                </div>
              ) : items.length === 0 ? (
                <div className="font-sans text-[13px] text-ink-faint py-10 text-center">
                  {debouncedKeyword ? `无匹配 "${debouncedKeyword}"` : '暂无数据'}
                </div>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {items.map((it) => {
                    const key = String(getItemKey(it))
                    const isActive = key === value
                    const label = getItemLabel(it)
                    const subtitle = getItemSubtitle?.(it)
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => handlePick(it)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left',
                            'hover:bg-sage/10 transition-colors',
                            isActive && 'bg-sage/10',
                          )}
                        >
                          <span className="flex-1 min-w-0">
                            <span className="font-sans text-[13px] text-ink block truncate">
                              {label || `#${key}`}
                            </span>
                            {subtitle ? (
                              <span className="font-folio text-[11px] text-ink-faint block truncate">
                                {subtitle}
                              </span>
                            ) : null}
                          </span>
                          <span className="font-folio text-[11px] text-ink-faint shrink-0">
                            #{key}
                          </span>
                          {isActive ? (
                            <Check className="h-4 w-4 text-sage shrink-0" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                  {hasNextPage ? (
                    <li>
                      <button
                        type="button"
                        disabled={isFetchingNextPage}
                        onClick={() => fetchNextPage()}
                        className={cn(
                          'w-full px-3 py-2.5 text-center font-sans text-[12px] text-ink-soft',
                          'hover:bg-sage/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                        )}
                      >
                        {isFetchingNextPage ? '加载中…' : '加载更多'}
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}

              {isFetching && !isPending ? (
                <div className="font-sans text-[11px] text-ink-faint py-1 text-center border-t border-line-soft">
                  同步中…
                </div>
              ) : null}
            </div>

            {data ? (
              <div className="font-folio text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                {items.length} shown · {loadedTotal} loaded / {serverTotal}
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">取消</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
