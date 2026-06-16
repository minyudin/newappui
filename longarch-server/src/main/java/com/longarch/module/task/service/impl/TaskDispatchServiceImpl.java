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
import com.longarch.module.task.service.TaskDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

            // 更新任务状态为 dispatched
            taskMapper.update(null,
                    new LambdaUpdateWrapper<OperationTask>()
                            .eq(OperationTask::getId, task.getId())
                            .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                            .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.DISPATCHED.getValue()));

            // 构建 MQTT 指令
            DeviceCommand command = new DeviceCommand();
            command.setTaskId(task.getId());
            command.setTaskNo(task.getTaskNo());
            command.setDeviceId(device.getId());
            command.setDeviceNo(device.getDeviceNo());
            command.setActionType(task.getActionType());
            command.setCallbackTopic(mqttProperties.getCallbackTopicPrefix() + device.getDeviceNo());
            long issuedAt = System.currentTimeMillis();
            command.setTimestamp(issuedAt);
            command.setExpiresAt(issuedAt + Math.max(1, mqttProperties.getCommandTtlSeconds()) * 1000L);

            if (task.getActionParams() != null && !task.getActionParams().isBlank()) {
                try {
                    command.setActionParams(objectMapper.readValue(task.getActionParams(), new TypeReference<Map<String, Object>>() {}));
                } catch (Exception e) {
                    log.warn("Failed to parse actionParams for taskId={}: {}", task.getId(), e.getMessage());
                }
            }

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

            Map<String, Object> snapshot = new HashMap<>();
            for (SensorDevice sensor : sensors) {
                SensorData latest = sensorDataMapper.selectOne(
                        new LambdaQueryWrapper<SensorData>()
                                .eq(SensorData::getSensorId, sensor.getId())
                                .orderByDesc(SensorData::getSampleAt)
                                .last("LIMIT 1"));
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
        } else {
            OperationTask latest = taskMapper.selectById(task.getId());
            log.info("markFailed ignored due to state mismatch: taskId={}, currentStatus={}",
                    task.getId(), latest != null ? latest.getTaskStatus() : "null");
        }
    }
}
