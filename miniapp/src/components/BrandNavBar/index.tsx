import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import './index.scss'

/**
 * BrandNavBar · 品牌自定义导航栏
 * ============================================================
 *  全局 navigationStyle: custom 后, 每页顶部挂这条品牌栏:
 *    · fixed 悬停, 页面滚动不消失 (沉浸式导航栏)
 *    · 高度对齐右上角微信胶囊按钮, 品牌名与胶囊同一行
 *    · 品牌字标: LONGARCH (衬线大写加宽) / 陇上管家 (加字距)
 *    · 非 tab 页自动显示返回键 (custom 导航没有原生返回)
 *  组件自带同高度 spacer, 页面内容无需自己留出顶部空间.
 * ============================================================ */

const TAB_PATHS = new Set([
  'pages/home/index',
  'pages/operator-workbench/index',
  'pages/adoptions/index',
  'pages/ai-assist/index',
  'pages/me/index',
])

interface Props {
  /** 强制隐藏返回键 (如登录页) */
  hideBack?: boolean
}

export default function BrandNavBar({ hideBack }: Props) {
  // 胶囊按钮位置只与机型/系统有关, 首渲染取一次即可
  const layout = useMemo(() => {
    const menu = Taro.getMenuButtonBoundingClientRect()
    const win = Taro.getWindowInfo()
    const statusBar = win.statusBarHeight ?? 20
    // 导航栏高度: 胶囊上下各留出与状态栏的间隙, 保证品牌名与胶囊垂直居中
    const navHeight = (menu.top - statusBar) * 2 + menu.height
    return { statusBar, navHeight, menuLeft: menu.left }
  }, [])

  const showBack = useMemo(() => {
    if (hideBack) return false
    const pages = Taro.getCurrentPages()
    if (pages.length <= 1) return false
    const route = pages[pages.length - 1]?.route ?? ''
    return !TAB_PATHS.has(route)
  }, [hideBack])

  return (
    <>
      <View className='brand-nav' style={{ paddingTop: `${layout.statusBar}px` }}>
        <View className='brand-nav__row' style={{ height: `${layout.navHeight}px` }}>
          {showBack ? (
            <View
              className='brand-nav__back'
              onClick={() => Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/home/index' }))}
            >
              <Text className='brand-nav__back-icon'>‹</Text>
            </View>
          ) : null}
          <View className='brand-nav__brand'>
            <Text className='brand-nav__brand-en'>LONGARCH</Text>
            <Text className='brand-nav__brand-cn'>陇 上 管 家</Text>
          </View>
        </View>
      </View>
      {/* 占位: 与 fixed 导航同高, 撑开页面内容 */}
      <View style={{ height: `${layout.statusBar + layout.navHeight}px` }} />
    </>
  )
}
