import { SearchableSelect, type SearchableSelectProps } from './SearchableSelect'
import { listOrders } from '@/api'
import { qk } from '@/lib/queryKeys'
import type { AdoptionOrder } from '@/types/api'

/**
 * OrderSelect · 认养订单选择器
 * ============================================================
 *  · 后端 /admin/adoption-orders 只支持 orderStatus/userId 过滤, 不支持 keyword
 *    → 走 clientSearch: 拉一页 200 条, 本地按 orderId/orderNo/userId/plotId 过滤
 *  · 展示: orderNo 或 #orderId (大字)  ·  status · plot · user (副字)
 * ============================================================ */

type OrderLike = AdoptionOrder & {
  orderNo?: string
  plotName?: string
  userName?: string
  nickname?: string
  adoptionType?: string
  payableAmount?: number | string
  createdAt?: string
}

type Props = Omit<
  SearchableSelectProps<OrderLike>,
  | 'fetchList'
  | 'queryKeyPrefix'
  | 'getItemKey'
  | 'getItemLabel'
  | 'getItemSubtitle'
  | 'clientSearch'
  | 'clientFilterFn'
  | 'placeholder'
  | 'dialogTitle'
  | 'dialogSeal'
  | 'searchParamKey'
>

export function OrderSelect(props: Props) {
  return (
    <SearchableSelect<OrderLike>
      {...props}
      fetchList={(params) => listOrders({ ...params, pageSize: 200 })}
      queryKeyPrefix={qk.orders.all()}
      getItemKey={(o) => o.orderId}
      getItemLabel={(o) => o.orderNo ? String(o.orderNo) : `订单 #${o.orderId}`}
      getItemSubtitle={(o) => {
        const parts: string[] = []
        if (o.orderStatus) parts.push(String(o.orderStatus))
        if (o.plotName) parts.push(`地块 ${o.plotName}`)
        else if (o.plotId) parts.push(`plot #${o.plotId}`)
        if (o.nickname || o.userName) parts.push(String(o.nickname ?? o.userName))
        else if (o.userId) parts.push(`user #${o.userId}`)
        return parts.join(' · ')
      }}
      placeholder="点击选择订单…"
      dialogTitle="选择订单"
      dialogSeal="§ LOOKUP · orders"
      clientSearch
      pageSize={200}
      clientFilterFn={(o, kw) =>
        String(o.orderId).includes(kw) ||
        String(o.orderNo ?? '').toLowerCase().includes(kw) ||
        String(o.plotName ?? '').toLowerCase().includes(kw) ||
        String(o.plotId ?? '').includes(kw) ||
        String(o.nickname ?? o.userName ?? '').toLowerCase().includes(kw) ||
        String(o.userId ?? '').includes(kw)
      }
    />
  )
}
