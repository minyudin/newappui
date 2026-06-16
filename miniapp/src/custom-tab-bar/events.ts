/**
 * tabBar 跨实例通信事件契约
 * ============================================================
 *  为什么单列文件:
 *    · custom-tab-bar/index.tsx 是 Taro 的 "custom tabBar" 约定入口,
 *      会被当成独立 chunk 打包, 从 index.tsx 里 named-export 的常量
 *      不一定能被其它页面 import 到 (webpack warning: possible exports: default)
 *    · 拎到独立文件让 named export 走普通模块解析, 双方都能稳定引用
 *
 *  用法:
 *    · tab 页面在 useDidShow 里 trigger 广播自己 pagePath
 *    · CustomTabBar 组件 useEffect 订阅, 收到后 setSelected
 * ============================================================ */
export const TAB_BAR_SYNC_EVT = 'custom-tab-bar:sync'
