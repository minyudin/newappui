import { SearchableSelect, type SearchableSelectProps } from './SearchableSelect'
import { listPlots } from '@/api'
import { qk } from '@/lib/queryKeys'
import type { Plot } from '@/types/api'

/**
 * PlotSelect · 地块选择器
 * ============================================================
 *  · 后端 /admin/plots 不支持 keyword 参数
 *    → 走 clientSearch: 拉一页 200 条, 本地按 plotName/plotNo/farmName/plotId 过滤
 *  · 展示: plotName (大字)  ·  plotNo (副字)  ·  #plotId
 * ============================================================ */

type PlotLike = Plot & {
  plotName?: string
  plotNo?: string
  farmName?: string
}

type Props = Omit<
  SearchableSelectProps<PlotLike>,
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

export function PlotSelect(props: Props) {
  return (
    <SearchableSelect<PlotLike>
      {...props}
      fetchList={(params) => listPlots({ ...params, pageSize: 200 })}
      queryKeyPrefix={qk.plots.all()}
      getItemKey={(p) => p.plotId}
      getItemLabel={(p) => p.plotName || p.name || `地块 #${p.plotId}`}
      getItemSubtitle={(p) => {
        const parts: string[] = []
        if (p.plotNo) parts.push(String(p.plotNo))
        if (p.farmName) parts.push(String(p.farmName))
        return parts.join(' · ')
      }}
      placeholder="点击选择地块…"
      dialogTitle="选择地块"
      dialogSeal="§ LOOKUP · plots"
      clientSearch
      pageSize={200}
      clientFilterFn={(p, kw) =>
        String(p.plotName ?? '').toLowerCase().includes(kw) ||
        String(p.plotNo ?? '').toLowerCase().includes(kw) ||
        String(p.farmName ?? '').toLowerCase().includes(kw) ||
        String(p.plotId).includes(kw)
      }
    />
  )
}
