package com.longarch.module.task.scheduler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.longarch.common.enums.DeviceExecutionState;
import com.longarch.common.enums.TaskStatus;
import com.longarch.common.metrics.DeviceObservabilityMetrics;
import com.longarch.module.task.entity.DeviceLock;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.DeviceLockMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.service.SchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 定时扫描超时的设备锁和任务：
 * 1. 锁过期 → 释放锁 + 标记任务失败 + 调度下一个
 * 2. DISPATCHED 状态超过 5 分钟无回调 → 标记超时失败
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskTimeoutScheduler {

    private final DeviceLockMapper deviceLockMapper;
    private final OperationTaskMapper taskMapper;
    private final SchedulerService schedulerService;
    private final DeviceObservabilityMetrics deviceObservabilityMetrics;

    /**
     * 每 60 秒扫描一次过期的设备锁
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void checkExpiredLocks() {
        List<DeviceLock> expiredLocks = deviceLockMapper.selectList(
                new LambdaQueryWrapper<DeviceLock>()
                        .eq(DeviceLock::getLockStatus, "locked")
                        .isNotNull(DeviceLock::getLockExpireAt)
                        .lt(DeviceLock::getLockExpireAt, LocalDateTime.now()));

        for (DeviceLock lock : expiredLocks) {
            log.warn("Device lock expired: deviceId={}, currentTaskId={}, expireAt={}",
                    lock.getDeviceId(), lock.getCurrentTaskId(), lock.getLockExpireAt());

            // 标记关联任务为超时失败
            if (lock.getCurrentTaskId() != null) {
                OperationTask task = taskMapper.selectById(lock.getCurrentTaskId());
                if (task != null && !TaskStatus.valueOf(task.getTaskStatus().toUpperCase()).isTerminal()) {
                    int updated = taskMapper.update(null,
                            new LambdaUpdateWrapper<OperationTask>()
                                    .eq(OperationTask::getId, task.getId())
                                    .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                    .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                                    .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                                    .set(OperationTask::getFailReason, "设备执行超时，锁已过期")
                                    .set(OperationTask::getFinishedAt, LocalDateTime.now())
                                    .set(OperationTask::getCancelable, 0));
                    if (updated > 0) {
                        log.warn("Task marked failed due to lock expiry: taskId={}", task.getId());
                    } else {
                        log.info("Skip mark failed due to lock expiry, state mismatch: taskId={}", task.getId());
                    }
                }
            }

            // 释放锁
            lock.setLockStatus("free");
            lock.setCurrentTaskId(null);
            lock.setLockOwner(null);
            lock.setLockedAt(null);
            lock.setLockExpireAt(null);
            deviceLockMapper.updateById(lock);

            // 调度下一个排队任务
            schedulerService.dispatchNext(lock.getDeviceId());
        }

        if (!expiredLocks.isEmpty()) {
            log.info("Expired lock scan completed: {} locks released", expiredLocks.size());
        }
    }

    /**
     * 每 2 分钟扫描 DISPATCHED 超过 5 分钟但没收到回调的任务
     */
    @Scheduled(fixedDelay = 120_000, initialDelay = 60_000)
    @Transactional
    public void checkStaleDispatchedTasks() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<OperationTask> staleTasks = taskMapper.selectList(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                        .eq(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                        .lt(OperationTask::getStartedAt, threshold));

        for (OperationTask task : staleTasks) {
            log.warn("Stale dispatched task detected: taskId={}, startedAt={}", task.getId(), task.getStartedAt());
            int updated = taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .eq(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                            .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                            .set(OperationTask::getFailReason, "MQTT指令已下发但设备未在5分钟内回调")
                            .set(OperationTask::getFinishedAt, LocalDateTime.now())
                            .set(OperationTask::getCancelable, 0));
            if (updated == 0) {
                log.info("Skip mark stale dispatched task failed due to state mismatch: taskId={}", task.getId());
                continue;
            }
            deviceObservabilityMetrics.recordGateMisjudge("false_positive", task.getActionType());

            // 释放对应设备锁
            schedulerService.dispatchNext(task.getDeviceId());
        }

        if (!staleTasks.isEmpty()) {
            log.info("Stale dispatch scan completed: {} tasks marked failed", staleTasks.size());
        }
    }
}
