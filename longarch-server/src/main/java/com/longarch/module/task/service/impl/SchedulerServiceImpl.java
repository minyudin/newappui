package com.longarch.module.task.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.longarch.common.enums.DeviceExecutionState;
import com.longarch.common.enums.TaskStatus;
import com.longarch.module.task.entity.DeviceLock;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.entity.OperationTaskQueue;
import com.longarch.module.task.mapper.DeviceLockMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.mapper.OperationTaskQueueMapper;
import com.longarch.module.task.service.SchedulerService;
import com.longarch.module.task.service.TaskDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulerServiceImpl implements SchedulerService {

    private final OperationTaskMapper taskMapper;
    private final OperationTaskQueueMapper queueMapper;
    private final DeviceLockMapper deviceLockMapper;
    private final TaskDispatchService taskDispatchService;
    private final RedissonClient redissonClient;

    @Override
    @Transactional
    public void schedule(OperationTask task) {
        // 高风险/异常任务：进入 operator 队列，不允许自动调度执行
        if ("operator_required".equalsIgnoreCase(task.getReviewState())) {
            log.info("Skip schedule due to operator review required: taskId={}, deviceId={}",
                    task.getId(), task.getDeviceId());
            return;
        }
        Long deviceId = task.getDeviceId();
        withDeviceSchedulerLock(deviceId, () -> {
            log.info("Scheduling task: taskId={}, deviceId={}", task.getId(), deviceId);

            DeviceLock lock = deviceLockMapper.selectOne(
                    new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, deviceId));

            // 初始化设备锁记录（如果不存在）
            if (lock == null) {
                lock = new DeviceLock();
                lock.setDeviceId(deviceId);
                lock.setLockStatus("free");
                deviceLockMapper.insert(lock);
            }

            if ("free".equals(lock.getLockStatus())) {
                // 设备空闲，直接执行
                lock.setLockStatus("locked");
                lock.setCurrentTaskId(task.getId());
                lock.setLockOwner("task-" + task.getId());
                lock.setLockedAt(LocalDateTime.now());
                lock.setLockExpireAt(LocalDateTime.now().plusMinutes(30));
                deviceLockMapper.updateById(lock);

                int updated = taskMapper.update(null,
                        new LambdaUpdateWrapper<OperationTask>()
                                .eq(OperationTask::getId, task.getId())
                                .eq(OperationTask::getTaskStatus, TaskStatus.PENDING.getValue())
                                .set(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                                .set(OperationTask::getStartedAt, LocalDateTime.now())
                                .set(OperationTask::getCancelable, 0));
                if (updated == 0) {
                    log.info("Skip dispatch immediately due to task state mismatch: taskId={}", task.getId());
                    return;
                }

                log.info("Task dispatched immediately: taskId={}", task.getId());
                taskDispatchService.dispatch(task);
            } else {
                // 设备忙，入队
                long queueCount = queueMapper.selectCount(
                        new LambdaQueryWrapper<OperationTaskQueue>()
                                .eq(OperationTaskQueue::getDeviceId, deviceId)
                                .eq(OperationTaskQueue::getTaskStatus, "queued"));

                OperationTaskQueue queueEntry = new OperationTaskQueue();
                queueEntry.setTaskId(task.getId());
                queueEntry.setDeviceId(deviceId);
                queueEntry.setPlotId(task.getPlotId());
                queueEntry.setPriority(task.getPriority());
                queueEntry.setQueuedAt(LocalDateTime.now());
                queueEntry.setTaskStatus("queued");
                queueMapper.insert(queueEntry);

                int updated = taskMapper.update(null,
                        new LambdaUpdateWrapper<OperationTask>()
                                .eq(OperationTask::getId, task.getId())
                                .eq(OperationTask::getTaskStatus, TaskStatus.PENDING.getValue())
                                .set(OperationTask::getTaskStatus, TaskStatus.QUEUED.getValue())
                                .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.QUEUED.getValue())
                                .set(OperationTask::getQueuedAt, LocalDateTime.now())
                                .set(OperationTask::getQueueNo, (int) queueCount + 1)
                                .set(OperationTask::getEstimatedWaitMinutes, (int) (queueCount + 1) * 5));
                if (updated == 0) {
                    log.info("Skip queue due to task state mismatch: taskId={}", task.getId());
                    return;
                }

                log.info("Task queued: taskId={}, queueNo={}", task.getId(), task.getQueueNo());
            }
        });
    }

    @Override
    @Transactional
    public void dispatchNext(Long deviceId) {
        withDeviceSchedulerLock(deviceId, () -> {
            log.info("dispatchNext for deviceId={}", deviceId);

            // 查找队列中优先级最高、最早入队的任务
            OperationTaskQueue nextEntry = queueMapper.selectOne(
                    new LambdaQueryWrapper<OperationTaskQueue>()
                            .eq(OperationTaskQueue::getDeviceId, deviceId)
                            .eq(OperationTaskQueue::getTaskStatus, "queued")
                            .orderByDesc(OperationTaskQueue::getPriority)
                            .orderByAsc(OperationTaskQueue::getQueuedAt)
                            .last("LIMIT 1"));

            if (nextEntry == null) {
                // 队列空，释放设备锁
                DeviceLock lock = deviceLockMapper.selectOne(
                        new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, deviceId));
                if (lock != null) {
                    lock.setLockStatus("free");
                    lock.setCurrentTaskId(null);
                    lock.setLockOwner(null);
                    lock.setLockedAt(null);
                    lock.setLockExpireAt(null);
                    deviceLockMapper.updateById(lock);
                }
                log.info("No more queued tasks for deviceId={}, lock released", deviceId);
                return;
            }

            // 出队并执行
            OperationTask task = taskMapper.selectById(nextEntry.getTaskId());
            if (task == null || TaskStatus.valueOf(task.getTaskStatus().toUpperCase()).isTerminal()) {
                queueMapper.deleteById(nextEntry.getId());
                dispatchNext(deviceId); // 递归处理下一个
                return;
            }

            // 更新设备锁
            DeviceLock lock = deviceLockMapper.selectOne(
                    new LambdaQueryWrapper<DeviceLock>().eq(DeviceLock::getDeviceId, deviceId));
            lock.setCurrentTaskId(task.getId());
            lock.setLockOwner("task-" + task.getId());
            lock.setLockedAt(LocalDateTime.now());
            lock.setLockExpireAt(LocalDateTime.now().plusMinutes(30));
            lock.setLockStatus("locked");
            deviceLockMapper.updateById(lock);

            // 更新任务状态
            int updated = taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.QUEUED.getValue())
                            .set(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                            .set(OperationTask::getStartedAt, LocalDateTime.now())
                            .set(OperationTask::getCancelable, 0));
            if (updated == 0) {
                log.info("Skip dispatchNext due to task state mismatch: taskId={}", task.getId());
                return;
            }

            // 从队列移除
            queueMapper.deleteById(nextEntry.getId());

            log.info("Next task dispatched: taskId={}", task.getId());
            taskDispatchService.dispatch(task);
        });
    }

    private void withDeviceSchedulerLock(Long deviceId, Runnable action) {
        String lockKey = "scheduler:device:" + deviceId;
        RLock lock = redissonClient.getLock(lockKey);
        boolean locked = false;
        try {
            locked = lock.tryLock(3, 10, TimeUnit.SECONDS);
            if (!locked) {
                throw new IllegalStateException("Failed to acquire scheduler lock for device: " + deviceId);
            }
            action.run();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while acquiring scheduler lock for device: " + deviceId, e);
        } finally {
            if (locked && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }
}
