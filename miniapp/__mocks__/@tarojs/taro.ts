/**
 * Jest mock · @tarojs/taro
 * ============================================================
 *  单测里没有真小程序环境, 这里桩 Taro 的常用 API:
 *    · Storage (同步, 内存 Map)
 *    · request (可通过 __setMockRequestImpl 自定义返回)
 *    · login / navigateTo / redirectTo / showToast (jest.fn, 便于断言)
 *    · useLaunch / useLoad / usePullDownRefresh (立即同步执行, 便于测试)
 * ============================================================ */

// ---- Storage ----
const storage = new Map<string, unknown>()

export function getStorageSync<T = unknown>(key: string): T | '' {
  return (storage.has(key) ? (storage.get(key) as T) : '') as T | ''
}

export function setStorageSync(key: string, value: unknown): void {
  storage.set(key, value)
}

export function removeStorageSync(key: string): void {
  storage.delete(key)
}

export function clearStorageSync(): void {
  storage.clear()
}

// ---- 测试辅助: 直接读/清 storage ----
export function __getMockStorage() {
  return storage
}

export function __clearMockStorage() {
  storage.clear()
}

// ---- Network ----
let mockRequestImpl: ((opts: unknown) => unknown) | null = null

export function __setMockRequestImpl(fn: (opts: unknown) => unknown) {
  mockRequestImpl = fn
}

export function __resetMockRequestImpl() {
  mockRequestImpl = null
}

export const request = jest.fn((opts: unknown) => {
  if (mockRequestImpl) {
    return Promise.resolve(mockRequestImpl(opts))
  }
  // 默认返回一个 code=0 的空壳
  return Promise.resolve({
    statusCode: 200,
    data: { code: 0, message: 'ok', data: null },
    header: {},
  })
})

// ---- 导航 + UI ----
export const login = jest.fn(() => Promise.resolve({ code: 'mock_wx_code' }))
export const navigateTo = jest.fn(() => Promise.resolve())
export const redirectTo = jest.fn(() => Promise.resolve())
export const switchTab = jest.fn(() => Promise.resolve())
export const reLaunch = jest.fn(() => Promise.resolve())
export const showToast = jest.fn(() => Promise.resolve())
export const showModal = jest.fn(() => Promise.resolve({ confirm: true, cancel: false }))
export const stopPullDownRefresh = jest.fn(() => Promise.resolve())

// ---- React 生命周期 hooks (立即同步执行) ----
export const useLaunch = (fn: () => void) => {
  fn()
}
export const useLoad = (fn: () => void) => {
  fn()
}
export const useReady = (fn: () => void) => {
  fn()
}
export const useUnload = (_fn: () => void) => {
  // 单测里不触发 unload
}
export const usePullDownRefresh = (_fn: () => void) => {
  // 单测里不自动触发下拉, 需要时手动调用 fn
}

// ---- 默认导出: 模拟 Taro 全局对象 ----
const Taro = {
  getStorageSync,
  setStorageSync,
  removeStorageSync,
  clearStorageSync,
  request,
  login,
  navigateTo,
  redirectTo,
  switchTab,
  reLaunch,
  showToast,
  showModal,
  stopPullDownRefresh,
}

export default Taro
