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
 * 定时超时扫描 · 三条独立职责:
 *
 *   1. checkAckTimeout    (每 5s)  · 快速失败: DISPATCHED 状态下 ackDeadlineAt 过期
 *                                    -> 判"设备未在 ACK 窗口内确认接收", 覆盖设备离线/网络断
 *   2. checkResultTimeout (每 30s) · 自适应失败: RUNNING/NETWORK_PENDING 状态下 resultDeadlineAt 过期
 *                                    -> 判"执行超时", 超时窗口随任务时长动态计算
 *   3. checkExpiredLocks  (每 60s) · 设备锁租约到期: 释放锁 + 关联任务失败 + dispatchNext
 *
 * 语义详见 硬件对接指南.md §5.2 与 V10__task_two_phase_deadlines.sql
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
     * ACK 阶段超时: DISPATCHED 状态下 ackDeadlineAt 已过期, 意味着设备根本没确认收到.
     * 目的是让"设备离线/网络断"的失败尽快让用户可见 (默认 ~10s + 5s 扫描间隔).
     */
    @Scheduled(fixedDelay = 5_000, initialDelay = 15_000)
    @Transactional
    public void checkAckTimeout() {
        LocalDateTime now = LocalDateTime.now();
        List<OperationTask> staleTasks = taskMapper.selectList(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                        .eq(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                        .isNotNull(OperationTask::getAckDeadlineAt)
                        .lt(OperationTask::getAckDeadlineAt, now));

        for (OperationTask task : staleTasks) {
            log.warn("ACK timeout detected: taskId={}, ackDeadlineAt={}",
                    task.getId(), task.getAckDeadlineAt());
            int updated = taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .eq(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                            .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                            .set(OperationTask::getFailReason, "设备未在 ACK 窗口内确认接收(可能离线或网络中断)")
                            .set(OperationTask::getFinishedAt, LocalDateTime.now())
                            .set(OperationTask::getAckDeadlineAt, null)
                            .set(OperationTask::getResultDeadlineAt, null)
                            .set(OperationTask::getCancelable, 0));
            if (updated == 0) {
                log.info("Skip mark ACK-timeout failed due to state mismatch: taskId={}", task.getId());
                continue;
            }
            deviceObservabilityMetrics.recordGateMisjudge("ack_timeout", task.getActionType());
            schedulerService.dispatchNext(task.getDeviceId());
        }

        if (!staleTasks.isEmpty()) {
            log.info("ACK timeout scan completed: {} tasks marked failed", staleTasks.size());
        }
    }

    /**
     * Result 阶段超时: RUNNING 或 NETWORK_PENDING_CONFIRMATION 状态下 resultDeadlineAt 已过期.
     * 意味着设备接收了指令但没能在 (durationSeconds + slack) 内完成动作, 判"执行超时".
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    @Transactional
    public void checkResultTimeout() {
        LocalDateTime now = LocalDateTime.now();
        List<OperationTask> staleTasks = taskMapper.selectList(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                        .in(OperationTask::getDeviceExecutionState,
                                DeviceExecutionState.RUNNING.getValue(),
                                DeviceExecutionState.NETWORK_PENDING_CONFIRMATION.getValue())
                        .isNotNull(OperationTask::getResultDeadlineAt)
                        .lt(OperationTask::getResultDeadlineAt, now));

        for (OperationTask task : staleTasks) {
            log.warn("Result timeout detected: taskId={}, resultDeadlineAt={}, state={}",
                    task.getId(), task.getResultDeadlineAt(), task.getDeviceExecutionState());
            int updated = taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .in(OperationTask::getDeviceExecutionState,
                                    DeviceExecutionState.RUNNING.getValue(),
                                    DeviceExecutionState.NETWORK_PENDING_CONFIRMATION.getValue())
                            .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                            .set(OperationTask::getFailReason, "设备已接收但未在预期时长内完成执行")
                            .set(OperationTask::getFinishedAt, LocalDateTime.now())
                            .set(OperationTask::getAckDeadlineAt, null)
                            .set(OperationTask::getResultDeadlineAt, null)
                            .set(OperationTask::getCancelable, 0));
            if (updated == 0) {
                log.info("Skip mark result-timeout failed due to state mismatch: taskId={}", task.getId());
                continue;
            }
            deviceObservabilityMetrics.recordGateMisjudge("result_timeout", task.getActionType());
            schedulerService.dispatchNext(task.getDeviceId());
        }

        if (!staleTasks.isEmpty()) {
            log.info("Result timeout scan completed: {} tasks marked failed", staleTasks.size());
        }
    }

    /**
     * 设备锁过期扫描 · 与两阶段回执正交.
     *   · 锁 TTL 默认 30 分钟(SchedulerServiceImpl 里设置)
     *   · 兜底防止设备锁被意外遗留 (进程崩溃/网络分区等极端情况)
     *   · 正常路径下, success/failed 回执 或 ACK/Result 超时 都会走 dispatchNext 主动释放锁
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

            if (lock.getCurrentTaskId() != null) {
                OperationTask task = taskMapper.selectById(lock.getCurrentTaskId());
                if (task != null && !TaskStatus.valueOf(task.getTaskStatus().toUpperCase()).isTerminal()) {
                    int updated = taskMapper.update(null,
                            new LambdaUpdateWrapper<OperationTask>()
                                    .eq(OperationTask::getId, task.getId())
                                    .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                    .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                                    .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                                    .set(OperationTask::getFailReason, "设备执行超时,锁已过期")
                                    .set(OperationTask::getFinishedAt, LocalDateTime.now())
                                    .set(OperationTask::getAckDeadlineAt, null)
                                    .set(OperationTask::getResultDeadlineAt, null)
                                    .set(OperationTask::getCancelable, 0));
                    if (updated > 0) {
                        log.warn("Task marked failed due to lock expiry: taskId={}", task.getId());
                    } else {
                        log.info("Skip mark failed due to lock expiry, state mismatch: taskId={}", task.getId());
                    }
                }
            }

            lock.setLockStatus("free");
            lock.setCurrentTaskId(null);
            lock.setLockOwner(null);
            lock.setLockedAt(null);
            lock.setLockExpireAt(null);
            deviceLockMapper.updateById(lock);

            schedulerService.dispatchNext(lock.getDeviceId());
        }

        if (!expiredLocks.isEmpty()) {
            log.info("Expired lock scan completed: {} locks released", expiredLocks.size());
        }
    }
}
