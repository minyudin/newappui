/**
 * Unit · api/task
 * ============================================================
 *  验证 5 个导出:
 *    · genIdempotencyKey — 唯一性
 *    · getAllowedActions — URL 拼 + 脱壳
 *    · createOperationTask — body 字段传对
 *    · getMyOperationTasks — 分页 + status 查询串
 *    · cancelTask — body 按 reason 有无切换
 * ============================================================ */
import { request as TaroRequest } from '@tarojs/taro'
import {
  __setMockRequestImpl,
  __resetMockRequestImpl,
} from '@mocks/@tarojs/taro'
import {
  genIdempotencyKey,
  getAllowedActions,
  createOperationTask,
  getMyOperationTasks,
  cancelTask,
} from './task'

interface RequestCall {
  url: string
  method?: string
  data?: Record<string, unknown>
  header?: Record<string, string>
}

function lastCall(): RequestCall {
  const mock = TaroRequest as jest.Mock
  return mock.mock.calls[mock.mock.calls.length - 1][0] as RequestCall
}

describe('api/task', () => {
  beforeEach(() => {
    __resetMockRequestImpl()
    ;(TaroRequest as jest.Mock).mockClear()
  })

  describe('genIdempotencyKey', () => {
    it('每次生成的 key 不同', () => {
      const a = genIdempotencyKey()
      const b = genIdempotencyKey()
      expect(a).not.toBe(b)
    })

    it('默认 MP_ 前缀', () => {
      expect(genIdempotencyKey()).toMatch(/^MP_/)
    })

    it('可自定义前缀', () => {
      expect(genIdempotencyKey('TEST')).toMatch(/^TEST_/)
    })
  })

  describe('getAllowedActions', () => {
    it('GET 请求路径含 plotId, 脱壳返回 data', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: { plotId: 123, actions: [] },
        },
      }))

      const res = await getAllowedActions(123)
      expect(res).toEqual({ plotId: 123, actions: [] })

      const call = lastCall()
      expect(call.method).toBe('GET')
      expect(call.url).toMatch(/\/plots\/123\/allowed-actions$/)
    })
  })

  describe('createOperationTask', () => {
    it('POST /operation-tasks 传全量 body', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: {
            taskId: 999,
            taskNo: 'T-001',
            taskStatus: 'pending',
            queueNo: null,
            estimatedWaitMinutes: null,
            deviceExecutionState: 'submitted',
            message: null,
          },
        },
      }))

      const res = await createOperationTask({
        plotId: 30001,
        deviceId: 80001,
        actionType: 'irrigation_apply',
        actionParams: { durationMinutes: 10 },
        schedulingMode: 'asap',
        idempotencyKey: 'MP_test_abc',
      })

      expect(res.taskId).toBe(999)

      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toMatch(/\/operation-tasks$/)
      expect(call.data).toEqual({
        plotId: 30001,
        deviceId: 80001,
        actionType: 'irrigation_apply',
        actionParams: { durationMinutes: 10 },
        schedulingMode: 'asap',
        idempotencyKey: 'MP_test_abc',
      })
    })

    it('业务错时 throw · silent 不 toast (避免 http.ts 二次 toast)', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: { code: 40013, message: '不在允许操作时段', data: null },
      }))

      await expect(
        createOperationTask({
          plotId: 1,
          deviceId: 1,
          actionType: 'irrigation_apply',
          actionParams: {},
          schedulingMode: 'asap',
          idempotencyKey: 'MP_x',
        }),
      ).rejects.toThrow('不在允许操作时段')
    })
  })

  describe('getMyOperationTasks', () => {
    it('默认分页参数 pageNo=1 pageSize=20', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: { list: [], total: 0, pageNo: 1, pageSize: 20 },
        },
      }))

      await getMyOperationTasks()
      const call = lastCall()
      expect(call.url).toMatch(/pageNo=1/)
      expect(call.url).toMatch(/pageSize=20/)
      expect(call.url).not.toMatch(/taskStatus/)
    })

    it('带 taskStatus 过滤', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: { list: [], total: 0, pageNo: 1, pageSize: 50 },
        },
      }))

      await getMyOperationTasks({ pageNo: 2, pageSize: 50, taskStatus: 'running' })
      const call = lastCall()
      expect(call.url).toMatch(/pageNo=2/)
      expect(call.url).toMatch(/pageSize=50/)
      expect(call.url).toMatch(/taskStatus=running/)
    })
  })

  describe('cancelTask', () => {
    it('POST /operation-tasks/{id}/cancel · 无 reason 时 body 为空对象', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: { taskId: 1, taskStatus: 'cancelled', cancelled: true },
        },
      }))

      await cancelTask(1)
      const call = lastCall()
      expect(call.method).toBe('POST')
      expect(call.url).toMatch(/\/operation-tasks\/1\/cancel$/)
      expect(call.data).toEqual({})
    })

    it('有 reason 时 body 带 reason 字段', async () => {
      __setMockRequestImpl(() => ({
        statusCode: 200,
        data: {
          code: 0,
          message: 'ok',
          data: { taskId: 42, taskStatus: 'cancelled', cancelled: true },
        },
      }))

      await cancelTask(42, '用户主动取消')
      const call = lastCall()
      expect(call.data).toEqual({ reason: '用户主动取消' })
    })
  })
})
