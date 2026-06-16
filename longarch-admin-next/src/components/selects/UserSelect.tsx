import { SearchableSelect, type SearchableSelectProps } from './SearchableSelect'
import { listUsers } from '@/api'
import { qk } from '@/lib/queryKeys'
import type { AdminUser } from '@/types/api'

/**
 * UserSelect · 用户选择器
 * ============================================================
 *  · 后端 /admin/users 已支持 keyword 参数 (模糊匹配 nickname/openId/mobile)
 *    → 走后端搜索, 不开 clientSearch
 *  · 展示: nickname (大字)  ·  mobile / openId / userNo (副字)
 * ============================================================ */

type Props = Omit<
  SearchableSelectProps<AdminUser>,
  | 'fetchList'
  | 'queryKeyPrefix'
  | 'getItemKey'
  | 'getItemLabel'
  | 'getItemSubtitle'
  | 'placeholder'
  | 'dialogTitle'
  | 'dialogSeal'
  | 'searchParamKey'
>

export function UserSelect(props: Props) {
  return (
    <SearchableSelect<AdminUser>
      {...props}
      fetchList={(params) => listUsers(params)}
      queryKeyPrefix={qk.users.all()}
      getItemKey={(u) => u.userId}
      getItemLabel={(u) => u.nickname || u.realName || `用户 #${u.userId}`}
      getItemSubtitle={(u) => {
        const parts: string[] = []
        if (u.mobile) parts.push(String(u.mobile))
        if (u.userNo) parts.push(String(u.userNo))
        if (u.roleType) parts.push(String(u.roleType))
        return parts.join(' · ')
      }}
      placeholder="点击选择用户…"
      dialogTitle="选择用户"
      dialogSeal="§ LOOKUP · users"
      searchParamKey="keyword"
    />
  )
}
