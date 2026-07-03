package com.longarch.module.task.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.config.MqttProperties;
import com.longarch.common.enums.DeviceExecutionState;
import com.longarch.common.enums.TaskStatus;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.DeviceExecutionLog;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import com.longarch.module.task.mapper.DeviceExecutionLogMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.mqtt.DeviceCommand;
import com.longarch.module.task.mqtt.MqttGateway;
import com.longarch.module.task.service.SchedulerService;
import com.longarch.module.task.service.TaskDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskDispatchServiceImpl implements TaskDispatchService {

    private final OperationTaskMapper taskMapper;
    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final DeviceExecutionLogMapper executionLogMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final MqttGateway mqttGateway;
    private final MqttProperties mqttProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationContext applicationContext;

    @Async
    @Override
    public void dispatch(OperationTask task) {
        log.info("Dispatching task via MQTT: taskId={}, deviceId={}", task.getId(), task.getDeviceId());

        try {
            ActuatorDevice device = actuatorDeviceMapper.selectById(task.getDeviceId());
            if (device == null) {
                markFailed(task, "设备不存在: deviceId=" + task.getDeviceId());
                return;
            }

            // 采集执行前的传感器快照
            String sensorBefore = collectSensorSnapshot(task.getPlotId());

            // 先解析 actionParams (dispatch 前算 result deadline 要用到 durationMinutes)
            Map<String, Object> paramsMap = null;
            if (task.getActionParams() != null && !task.getActionParams().isBlank()) {
                try {
                    paramsMap = objectMapper.readValue(task.getActionParams(), new TypeReference<Map<String, Object>>() {});
                } catch (Exception e) {
                    log.warn("Failed to parse actionParams for taskId={}: {}", task.getId(), e.getMessage());
                }
            }

            // 两阶段截止时间 · 详见 硬件对接指南.md §5.2
            long issuedAt = System.currentTimeMillis();
            long ackTimeoutMs = Math.max(1, mqttProperties.getAckTimeoutSeconds()) * 1000L;
            long durationSeconds = extractDurationSeconds(paramsMap);
            long resultTimeoutSeconds = Math.max(
                    mqttProperties.getResultTimeoutMinSeconds(),
                    durationSeconds + mqttProperties.getResultTimeoutSlackSeconds());
            long resultTimeoutMs = resultTimeoutSeconds * 1000L;
            LocalDateTime ackDeadline = LocalDateTime.now().plusNanos(ackTimeoutMs * 1_000_000L);
            LocalDateTime resultDeadline = LocalDateTime.now().plusNanos(resultTimeoutMs * 1_000_000L);

            // 更新任务状态为 dispatched, 同时写入两阶段 deadline
            taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue())
                            .set(OperationTask::getAckDeadlineAt, ackDeadline)
                            .set(OperationTask::getResultDeadlineAt, resultDeadline));

            // 构建 MQTT 指令
            DeviceCommand command = new DeviceCommand();
            command.setTaskId(task.getId());
            command.setTaskNo(task.getTaskNo());
            command.setDeviceId(device.getId());
            command.setDeviceNo(device.getDeviceNo());
            command.setActionType(task.getActionType());
            command.setCallbackTopic(mqttProperties.getCallbackTopicPrefix() + device.getDeviceNo());
            command.setTimestamp(issuedAt);
            // expiresAt = Result deadline · 让设备端也能自校验, 双侧一致
            command.setExpiresAt(issuedAt + resultTimeoutMs);
            command.setActionParams(paramsMap);

            String topic = mqttProperties.getCommandTopicPrefix() + device.getDeviceNo();
            String payload = objectMapper.writeValueAsString(command);

            // 写入执行日志（记录完整指令内容 + 执行前传感器数据）
            DeviceExecutionLog execLog = new DeviceExecutionLog();
            execLog.setTaskId(task.getId());
            execLog.setDeviceId(device.getId());
            execLog.setDeviceNo(device.getDeviceNo());
            execLog.setActionType(task.getActionType());
            execLog.setCommandPayload(payload);
            execLog.setExecutionStatus("dispatched");
            execLog.setSensorBefore(sensorBefore);
            execLog.setDispatchedAt(LocalDateTime.now());
            executionLogMapper.insert(execLog);

            // 发送 MQTT
            mqttGateway.sendToMqtt(topic, mqttProperties.getCommandQos(), payload);
            log.info("MQTT command sent: topic={}, taskId={}, deviceNo={}, execLogId={}",
                    topic, task.getId(), device.getDeviceNo(), execLog.getId());

        } catch (Exception e) {
            log.error("Failed to dispatch task via MQTT: taskId={}", task.getId(), e);
            markFailed(task, "MQTT指令发送失败: " + e.getMessage());
        }
    }

    /**
     * 采集地块当前所有传感器的最新读数，作为执行前快照
     */
    private String collectSensorSnapshot(Long plotId) {
        try {
            List<SensorDevice> sensors = sensorDeviceMapper.selectList(
                    new LambdaQueryWrapper<SensorDevice>()
                            .eq(SensorDevice::getPlotId, plotId));
            if (sensors.isEmpty()) return null;

            // 批量取每个传感器各指标最新读数，单次查询替代逐 sensor 的 N+1
            List<Long> sensorIds = sensors.stream()
                    .map(SensorDevice::getId)
                    .collect(java.util.stream.Collectors.toList());
            Map<Long, SensorData> latestBySensor = new HashMap<>();
            for (SensorData row : sensorDataMapper.selectLatestPerType(sensorIds)) {
                latestBySensor.merge(row.getSensorId(), row, (a, b) ->
                        b.getSampleAt() != null
                                && (a.getSampleAt() == null || b.getSampleAt().isAfter(a.getSampleAt()))
                                ? b : a);
            }

            Map<String, Object> snapshot = new HashMap<>();
            for (SensorDevice sensor : sensors) {
                SensorData latest = latestBySensor.get(sensor.getId());
                if (latest != null) {
                    Map<String, Object> reading = new HashMap<>();
                    reading.put("sensorType", sensor.getSensorType());
                    reading.put("unit", sensor.getUnit());
                    reading.put("value", latest.getValue());
                    reading.put("sampleAt", latest.getSampleAt().toString());
                    snapshot.put(sensor.getDeviceNo(), reading);
                }
            }
            return snapshot.isEmpty() ? null : objectMapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            log.warn("Failed to collect sensor snapshot for plotId={}: {}", plotId, e.getMessage());
            return null;
        }
    }

    /**
     * 从 actionParams 中提取任务预期执行时长(秒), 优先级:
     *   1. durationMinutes  (最常见, task/index.tsx 表单默认字段)
     *   2. durationSeconds  (极少数动作用秒级)
     * 都没有则返回 0, 由 resultTimeoutMinSeconds 兜底.
     */
    private long extractDurationSeconds(Map<String, Object> paramsMap) {
        if (paramsMap == null) return 0;
        Object mins = paramsMap.get("durationMinutes");
        if (mins instanceof Number) return ((Number) mins).longValue() * 60L;
        if (mins instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s.trim()) * 60L; } catch (NumberFormatException ignored) {}
        }
        Object secs = paramsMap.get("durationSeconds");
        if (secs instanceof Number) return ((Number) secs).longValue();
        if (secs instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return 0;
    }

    private void markFailed(OperationTask task, String reason) {
        int updated = taskMapper.update(null,
                new LambdaUpdateWrapper<OperationTask>()
                        .eq(OperationTask::getId, task.getId())
                        .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                        .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                        .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                        .set(OperationTask::getFailReason, reason)
                        .set(OperationTask::getCancelable, 0));
        if (updated > 0) {
            log.warn("Task marked failed: taskId={}, reason={}", task.getId(), reason);
            // P-01: dispatch 失败(如 MQTT 发送异常)后必须推进调度，
            //       否则设备锁要等 5~30 分钟定时器才释放。dispatchNext 会处理队列下一个
            //       任务或在队列空时释放锁，使设备在 <1s 内恢复可用。
            if (task.getDeviceId() != null) {
                try {
                    getSchedulerService().dispatchNext(task.getDeviceId());
                } catch (Exception e) {
                    log.error("dispatchNext after markFailed failed: taskId={}, deviceId={}, error={}",
                            task.getId(), task.getDeviceId(), e.getMessage());
                }
            }
        } else {
            OperationTask latest = taskMapper.selectById(task.getId());
            log.info("markFailed ignored due to state mismatch: taskId={}, currentStatus={}",
                    task.getId(), latest != null ? latest.getTaskStatus() : "null");
        }
    }

    // 延迟取 SchedulerService，打破 Scheduler ↔ Dispatch 的构造期循环依赖
    private SchedulerService getSchedulerService() {
        return applicationContext.getBean(SchedulerService.class);
    }
}
