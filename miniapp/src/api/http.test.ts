/**
 * Unit · api/http
 * ============================================================
 *  验证 request 封装的四条规则:
 *    1. code===0 脱壳返回 data.data
 *    2. code===40002 清 auth + 尝试 redirectTo /login (除非 silent)
 *    3. 其他非 0 throw + toast
 *    4. 请求 header 自动注入 satoken + X-Client-Type: miniapp
 * ============================================================ */
import { request as TaroRequest, redirectTo, showToast } from '@tarojs/taro'
import {
  __clearMockStorage,
  __setMockRequestImpl,
  __resetMockRequestImpl,
} from '@mocks/@tarojs/taro'
import { request } from './http'
import { useAuthStore } from '@/store/auth'

describe('api/http request', () => {
  beforeEach(() => {
    __clearMockStorage()
    __resetMockRequestImpl()
    useAuthStore.getState().clearAuth()
    ;(TaroRequest as jest.Mock).mockClear()
    ;(redirectTo as jest.Mock).mockClear()
    ;(showToast as jest.Mock).mockClear()
  })

  it('code=0 脱壳返回 data.data', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { foo: 'bar' } },
    }))

    const res = await request<{ foo: string }>({ url: '/test' })
    expect(res).toEqual({ foo: 'bar' })
  })

  it('header 自动注入 X-Client-Type: miniapp', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: null },
    }))

    await request({ url: '/test' })
    const callArgs = (TaroRequest as jest.Mock).mock.calls[0][0] as {
      header: Record<string, string>
    }
    expect(callArgs.header['X-Client-Type']).toBe('miniapp')
    expect(callArgs.header['Content-Type']).toBe('application/json')
  })

  it('store 里有 token · header 带 satoken', async () => {
    useAuthStore.getState().setAuth('tok-xyz', {
      userId: 1,
      userNo: 'U1',
      nickname: '测',
      roleType: 'adopter',
      status: 1,
      bindMobile: false,
    })
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: null },
    }))

    await request({ url: '/users/me' })
    const callArgs = (TaroRequest as jest.Mock).mock.calls[0][0] as {
      header: Record<string, string>
    }
    expect(callArgs.header.satoken).toBe('tok-xyz')
  })

  it('store 里没 token · header 不带 satoken', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: null },
    }))

    await request({ url: '/public/config' })
    const callArgs = (TaroRequest as jest.Mock).mock.calls[0][0] as {
      header: Record<string, string>
    }
    expect(callArgs.header.satoken).toBeUndefined()
  })

  it('code=40002 · 清 auth + redirectTo /login', async () => {
    useAuthStore.getState().setAuth('old-token', {
      userId: 1,
      userNo: 'U1',
      nickname: '测',
      roleType: 'adopter',
      status: 1,
      bindMobile: false,
    })
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 40002, message: '登录已失效', data: null },
    }))

    await expect(request({ url: '/users/me' })).rejects.toThrow('登录已失效')
    expect(useAuthStore.getState().token).toBeNull()
    expect(redirectTo).toHaveBeenCalledWith({ url: '/pages/login/index' })
    expect(showToast).toHaveBeenCalled()
  })

  it('silent=true · 40002 不 toast 不 redirect', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 40002, message: 'expired', data: null },
    }))

    await expect(
      request({ url: '/users/me', silent: true }),
    ).rejects.toThrow('expired')
    expect(redirectTo).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('其他非 0 code · toast 错误 + throw', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 200,
      data: { code: 50001, message: '地块不存在', data: null },
    }))

    await expect(request({ url: '/plots/999' })).rejects.toThrow('地块不存在')
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '地块不存在' }),
    )
  })

  it('HTTP 非 2xx · throw + toast 网络异常', async () => {
    __setMockRequestImpl(() => ({
      statusCode: 503,
      data: { code: 0, message: '', data: null },
    }))

    await expect(request({ url: '/test' })).rejects.toThrow('HTTP 503')
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('503') }),
    )
  })
})
