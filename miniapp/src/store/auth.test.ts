/**
 * Unit · store/auth
 * ============================================================
 *  覆盖 setAuth / setUserInfo / clearAuth / hydrate 四态
 *  持久化依赖 mock 版 Taro Storage (__mocks__/@tarojs/taro.ts)
 * ============================================================ */
import { setStorageSync } from '@tarojs/taro'
import { __clearMockStorage, __getMockStorage } from '@mocks/@tarojs/taro'
import { useAuthStore } from './auth'
import type { UserInfo } from '@/types'

const fakeUser: UserInfo = {
  userId: 42,
  userNo: 'U042',
  nickname: '测试认养人',
  roleType: 'adopter',
  status: 1,
  bindMobile: false,
  roleProfile: { roleName: '认养用户', roleDesc: 'mock' },
}

describe('store/auth', () => {
  beforeEach(() => {
    __clearMockStorage()
    useAuthStore.getState().clearAuth()
  })

  describe('setAuth', () => {
    it('写 token + userInfo 到内存 & Storage', () => {
      useAuthStore.getState().setAuth('tok-abc', fakeUser)

      const state = useAuthStore.getState()
      expect(state.token).toBe('tok-abc')
      expect(state.userInfo).toEqual(fakeUser)

      const storage = __getMockStorage()
      expect(storage.get('satoken')).toBe('tok-abc')
      expect(storage.get('userinfo')).toEqual(fakeUser)
    })
  })

  describe('setUserInfo', () => {
    it('只更新 userInfo · token 保持不变', () => {
      useAuthStore.getState().setAuth('tok-1', fakeUser)
      useAuthStore
        .getState()
        .setUserInfo({ ...fakeUser, nickname: '改名了' })

      const state = useAuthStore.getState()
      expect(state.token).toBe('tok-1')
      expect(state.userInfo?.nickname).toBe('改名了')

      const storage = __getMockStorage()
      expect((storage.get('userinfo') as UserInfo).nickname).toBe('改名了')
    })
  })

  describe('clearAuth', () => {
    it('清内存 & Storage', () => {
      useAuthStore.getState().setAuth('tok', fakeUser)
      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.userInfo).toBeNull()

      const storage = __getMockStorage()
      expect(storage.has('satoken')).toBe(false)
      expect(storage.has('userinfo')).toBe(false)
    })
  })

  describe('hydrate', () => {
    it('Storage 空 · 内存也空', () => {
      useAuthStore.getState().hydrate()
      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.userInfo).toBeNull()
    })

    it('Storage 有值 · hydrate 后内存同步到 Storage', () => {
      setStorageSync('satoken', 'pre-existing-token')
      setStorageSync('userinfo', fakeUser)

      useAuthStore.getState().hydrate()

      const state = useAuthStore.getState()
      expect(state.token).toBe('pre-existing-token')
      expect(state.userInfo).toEqual(fakeUser)
    })
  })
})
