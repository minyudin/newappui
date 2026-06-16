import { View } from '@tarojs/components'

/**
 * FolioCorners · 4 角规矩线
 * ============================================================
 *  挂在 app 根上, 给整个屏幕加 4 个 12×12 的直角短线,
 *  像版心校对标记. 纯装饰, pointer-events: none.
 * ============================================================ */
export default function FolioCorners() {
  return (
    <View className='folio-corners'>
      <View className='folio-corners__c folio-corners__c--tl' />
      <View className='folio-corners__c folio-corners__c--tr' />
      <View className='folio-corners__c folio-corners__c--bl' />
      <View className='folio-corners__c folio-corners__c--br' />
    </View>
  )
}
