package com.longarch.module.task.mqtt;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longarch.common.enums.DeviceExecutionState;
import com.longarch.common.enums.TaskStatus;
import com.longarch.common.metrics.DeviceObservabilityMetrics;
import com.longarch.module.camera.entity.CameraDevice;
import com.longarch.module.camera.mapper.CameraDeviceMapper;
import com.longarch.module.edge.entity.EdgeNode;
import com.longarch.module.edge.mapper.EdgeNodeMapper;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.entity.DeviceExecutionLog;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.DeviceExecutionLogMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.dashboard.MqttMessageBuffer;
import com.longarch.module.task.service.SchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 监听边缘设备通过 MQTT 回报的执行结果
 * Topic: longarch/device/callback/{deviceNo}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceCallbackListener {

    private final OperationTaskMapper taskMapper;
    private final DeviceExecutionLogMapper executionLogMapper;
    private final com.longarch.module.task.mapper.ActuatorDeviceMapper actuatorDeviceMapper;
    private final CameraDeviceMapper cameraDeviceMapper;
    private final EdgeNodeMapper edgeNodeMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final ObjectMapper objectMapper;
    private final ApplicationContext applicationContext;
    private final com.longarch.common.config.MqttProperties mqttProperties;
    private final MqttMessageBuffer mqttMessageBuffer;
    private final DeviceObservabilityMetrics deviceObservabilityMetrics;
    private final MqttMessageGuard mqttMessageGuard;

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    @Transactional
    public void handleCallback(Message<?> message) {
        String topic = (String) message.getHeaders().get("mqtt_receivedTopic");
        String payload = message.getPayload().toString();
        if (!mqttMessageGuard.acceptPayloadSize(topic, payload)) {
            return;
        }
        log.info("MQTT inbound received: topic={}, bytes={}",
                topic, payload != null ? payload.getBytes(StandardCharsets.UTF_8).length : 0);
        log.debug("MQTT inbound payload: topic={}, payload={}", topic, payload);

        // Record to ring buffer for dashboard MQTT log
        recordToBuffer("inbound", topic, payload);

        // 判断是否是遥测数据（走不同处理链路）
        if (topic != null && topic.startsWith(mqttProperties.getTelemetryTopicPrefix())) {
            handleTelemetry(topic, payload);
            return;
        }
        if (topic != null && topic.startsWith(mqttProperties.getHeartbeatTopicPrefix())) {
            handleHeartbeat(topic, payload);
            return;
        }

        DeviceCallbackPayload callback;
        try {
            callback = objectMapper.readValue(payload, DeviceCallbackPayload.class);
        } catch (Exception e) {
            log.error("Failed to parse device callback payload: topic={}, error={}", topic, e.getMessage());
            return;
        }

        String topicDeviceNo = mqttMessageGuard.topicSuffix(topic, mqttProperties.getCallbackTopicPrefix());
        if (!mqttMessageGuard.topicIdentityMatches("callback", topicDeviceNo, callback.getDeviceNo())) {
            return;
        }
        if (!mqttMessageGuard.acceptEnvelope(
                "callback", topicDeviceNo, callback.getMsgId(), callback.getSeq(), callback.getTimestamp())) {
            return;
        }

        if (callback.getTaskId() == null) {
            log.warn("Device callback missing taskId, ignored: topic={}", topic);
            return;
        }

        OperationTask task = taskMapper.selectById(callback.getTaskId());
        if (task == null) {
            log.warn("Task not found for callback: taskId={}", callback.getTaskId());
            return;
        }

        // 已经是终态的任务不再处理（防止重复回调）
        if (!callbackTaskDeviceMatchesTopic(task, topicDeviceNo)) {
            return;
        }
        TaskStatus currentStatus = TaskStatus.valueOf(task.getTaskStatus().toUpperCase());
        if (currentStatus.isTerminal()) {
            log.info("Task already in terminal state, callback ignored: taskId={}, status={}", task.getId(), task.getTaskStatus());
            return;
        }

        // 更新执行日志
        String dedupeKey = buildCallbackDedupeKey(callback, payload);
        updateExecutionLog(task, callback, payload, dedupeKey);

        String callbackStatus = callback.getStatus();
        switch (callbackStatus) {
            case "success" -> {
                int updated = taskMapper.update(null,
                        new LambdaUpdateWrapper<OperationTask>()
                                .eq(OperationTask::getId, task.getId())
                                .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                .set(OperationTask::getTaskStatus, TaskStatus.SUCCESS.getValue())
                                .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.SUCCESS.getValue())
                                .set(OperationTask::getFinishedAt, LocalDateTime.now())
                                .set(OperationTask::getCancelable, 0));
                if (updated > 0) {
                    log.info("Task completed successfully via callback: taskId={}", task.getId());
                } else {
                    log.info("Callback success ignored due to state mismatch: taskId={}, currentStatus={}",
                            task.getId(), taskMapper.selectById(task.getId()).getTaskStatus());
                    return;
                }

                getSchedulerService().dispatchNext(task.getDeviceId());
            }
            case "failed" -> {
                int updated = taskMapper.update(null,
                        new LambdaUpdateWrapper<OperationTask>()
                                .eq(OperationTask::getId, task.getId())
                                .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                .set(OperationTask::getTaskStatus, TaskStatus.FAILED.getValue())
                                .set(OperationTask::getDeviceExecutionState, DeviceExecutionState.FAILED.getValue())
                                .set(OperationTask::getFailReason, callback.getFailReason())
                                .set(OperationTask::getFinishedAt, LocalDateTime.now())
                                .set(OperationTask::getCancelable, 0));
                if (updated > 0) {
                    log.warn("Task failed via callback: taskId={}, reason={}", task.getId(), callback.getFailReason());
                } else {
                    log.info("Callback failed ignored due to state mismatch: taskId={}, currentStatus={}",
                            task.getId(), taskMapper.selectById(task.getId()).getTaskStatus());
                    return;
                }

                getSchedulerService().dispatchNext(task.getDeviceId());
            }
            case "network_pending_confirmation" -> {
                // 只允许在 running 状态下打这个中间态，避免终态被覆盖
                int updated = taskMapper.update(null,
                        new LambdaUpdateWrapper<OperationTask>()
                                .eq(OperationTask::getId, task.getId())
                                .eq(OperationTask::getTaskStatus, TaskStatus.RUNNING.getValue())
                                .set(OperationTask::getDeviceExecutionState,
                                        DeviceExecutionState.NETWORK_PENDING_CONFIRMATION.getValue()));
                if (updated > 0) {
                    log.info("Task awaiting network confirmation: taskId={}", task.getId());
                } else {
                    log.info("Callback pending-confirmation ignored due to state mismatch: taskId={}", task.getId());
                }
            }
            default -> log.warn("Unknown callback status: taskId={}, status={}", task.getId(), callbackStatus);
        }
    }

    /**
     * 更新 device_execution_log：存入回调原文、执行后传感器快照、实际耗时
     */
    private boolean callbackTaskDeviceMatchesTopic(OperationTask task, String topicDeviceNo) {
        if (task.getDeviceId() == null) {
            log.warn("Device callback rejected because task has no deviceId: taskId={}", task.getId());
            return false;
        }
        ActuatorDevice device = actuatorDeviceMapper.selectById(task.getDeviceId());
        if (device == null) {
            log.warn("Device callback rejected because task device is missing: taskId={}, deviceId={}",
                    task.getId(), task.getDeviceId());
            return false;
        }
        if (!device.getDeviceNo().equals(topicDeviceNo)) {
            log.warn("Device callback rejected because topic device does not own task: taskId={}, topicDeviceNo={}, taskDeviceNo={}",
                    task.getId(), topicDeviceNo, device.getDeviceNo());
            return false;
        }
        return true;
    }

    private void updateExecutionLog(OperationTask task, DeviceCallbackPayload callback, String rawPayload, String dedupeKey) {
        try {
            DeviceExecutionLog execLog = executionLogMapper.selectOne(
                    new LambdaQueryWrapper<DeviceExecutionLog>()
                            .eq(DeviceExecutionLog::getTaskId, task.getId())
                            .orderByDesc(DeviceExecutionLog::getDispatchedAt)
                            .last("LIMIT 1"));
            if (execLog == null) {
                log.warn("No execution log found for taskId={}, skipping log update", task.getId());
                return;
            }

            // 已写过 callback 的日志不再覆盖（防重复/乱序回调二次写入）
            if (execLog.getCallbackAt() != null) {
                log.info("Execution log already has callback, ignored: execLogId={}, taskId={}", execLog.getId(), task.getId());
                return;
            }

            LocalDateTime now = LocalDateTime.now();
            Integer durationSeconds = execLog.getDispatchedAt() != null
                    ? (int) Duration.between(execLog.getDispatchedAt(), now).getSeconds()
                    : null;
            String sensorAfter = collectSensorSnapshot(task.getPlotId());

            // 并发保护：仅当 callbackAt 仍为空时才允许写入
            int updated = executionLogMapper.update(null,
                    new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<DeviceExecutionLog>()
                            .eq(DeviceExecutionLog::getId, execLog.getId())
                            .isNull(DeviceExecutionLog::getCallbackAt)
                            .set(DeviceExecutionLog::getCallbackMsgId, callback.getMsgId())
                            .set(DeviceExecutionLog::getCallbackDedupeKey, dedupeKey)
                            .set(DeviceExecutionLog::getCallbackPayload, rawPayload)
                            .set(DeviceExecutionLog::getCallbackAt, now)
                            .set(DeviceExecutionLog::getExecutionStatus, callback.getStatus())
                            .set(DeviceExecutionLog::getActualDurationSeconds, durationSeconds)
                            .set(DeviceExecutionLog::getSensorAfter, sensorAfter));

            if (updated > 0) {
                log.info("Execution log updated: execLogId={}, status={}, duration={}s",
                        execLog.getId(), callback.getStatus(), durationSeconds);
            } else {
                log.info("Execution log callback write skipped due to concurrent update: execLogId={}", execLog.getId());
            }
        } catch (Exception e) {
            log.error("Failed to update execution log for taskId={}: {}", task.getId(), e.getMessage());
        }
    }

    private String buildCallbackDedupeKey(DeviceCallbackPayload callback, String rawPayload) {
        if (callback.getMsgId() != null && !callback.getMsgId().isBlank()) {
            return "msg:" + callback.getMsgId().trim();
        }
        if (callback.getSeq() != null) {
            return "seq:" + callback.getSeq();
        }
        long ts = callback.getTimestamp();
        String status = callback.getStatus() != null ? callback.getStatus() : "unknown";
        if (ts > 0) {
            return "ts:" + ts + ":" + status;
        }
        // 最弱兜底：hash(payload) + status（用于重复投递的抑制，不用于严格乱序判定）
        return "h:" + sha256Hex16(rawPayload) + ":" + status;
    }

    private String sha256Hex16(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest((input != null ? input : "").getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            // 取前 8 bytes -> 16 hex chars 足够做短去重 key
            for (int i = 0; i < 8 && i < bytes.length; i++) {
                sb.append(String.format("%02x", bytes[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return "na";
        }
    }

    /** 元数据 key，不作为传感器指标处理 */
    private static final java.util.Set<String> META_KEYS = java.util.Set.of(
            "time", "timestamp", "deviceNo", "device_no", "gatewayNo", "gateway_no", "ts", "seq", "msgId", "msg_id");

    /**
     * 处理传感器遥测数据上报
     *
     * Topic: longarch/device/telemetry/{sensorDeviceNo}
     *   deviceNo 从 topic 末段提取，payload 里不要求带 deviceNo
     *
     * Payload 支持任意 JSON，所有非元数据的数值字段都作为一条传感器读数存入：
     *   {"钾": 5.2, "氮": 3.1, "pH": 6.8, "time": "23:17"}
     *   {"soil_moisture": 45.2, "temperature": 22.1, "timestamp": 1713200000}
     *   {"钾": {"value": 5.2, "unit": "mg/kg"}, "time": "2026-04-15T23:17:00"}
     *
     * 网关批量上报 (gateway batch):
     *   Topic: longarch/device/telemetry/batch/{gatewayNo}
     *   Payload: {"gatewayNo":"GW-DM01","time":"...","sensors":[{"deviceNo":"...","data":{...}}, ...]}
     */
    private void handleTelemetry(String topic, String payload) {
        handleTelemetry(topic, payload, true);
    }

    private void handleTelemetry(String topic, String payload, boolean validateEnvelope) {
        // 网关批量上报：解包后对每个传感器复用单设备处理逻辑
        if (topic != null && topic.contains("/telemetry/batch/")) {
            handleBatchTelemetry(topic, payload);
            return;
        }
        try {
            // 1. 从 topic 提取 deviceNo
            String deviceNo = mqttMessageGuard.topicSuffix(topic, mqttProperties.getTelemetryTopicPrefix());
            if (deviceNo == null || deviceNo.isBlank()) {
                log.warn("Empty deviceNo in telemetry topic: {}", topic);
                return;
            }

            // 2. 查找传感器设备（payload 里也可以覆盖 deviceNo）
            Map<String, Object> data = objectMapper.readValue(payload,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            String payloadDeviceNo = mqttMessageGuard.stringField(data, "deviceNo", "device_no");
            if ((validateEnvelope || payloadDeviceNo != null)
                    && !mqttMessageGuard.topicIdentityMatches("telemetry", deviceNo, payloadDeviceNo)) {
                return;
            }
            if (validateEnvelope && !mqttMessageGuard.acceptEnvelope(
                    "telemetry",
                    deviceNo,
                    mqttMessageGuard.stringField(data, "msgId", "msg_id"),
                    mqttMessageGuard.longField(data, "seq"),
                    mqttMessageGuard.longField(data, "timestamp", "ts"))) {
                return;
            }

            SensorDevice sensor = sensorDeviceMapper.selectOne(
                    new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getDeviceNo, deviceNo));
            if (sensor == null) {
                log.warn("Unknown sensor device in telemetry: deviceNo={}", deviceNo);
                return;
            }

            // 3. 解析采样时间（支持多种格式）
            LocalDateTime sampleAt = parseSampleTime(data);

            // 4. 遍历所有字段，每个数值字段作为一条 sensor_data 存入
            java.math.BigDecimal lastValue = null;
            int count = 0;
            for (Map.Entry<String, Object> entry : data.entrySet()) {
                String key = entry.getKey();
                if (META_KEYS.contains(key)) continue;

                java.math.BigDecimal numericValue = extractNumericValue(entry.getValue());
                if (numericValue == null) continue;

                SensorData record = new SensorData();
                record.setSensorId(sensor.getId());
                record.setPlotId(sensor.getPlotId());
                record.setSensorType(key);
                record.setValue(numericValue);
                record.setSampleAt(sampleAt);
                sensorDataMapper.insert(record);

                lastValue = numericValue;
                count++;
            }

            // 5. 更新传感器设备在线状态
            if (lastValue != null) {
                sensor.setLastValue(lastValue);
            }
            sensor.setLastSampleAt(sampleAt);
            sensor.setStatus("online");
            sensorDeviceMapper.updateById(sensor);

            log.info("Telemetry stored: deviceNo={}, metrics={}, sampleAt={}", deviceNo, count, sampleAt);
        } catch (Exception e) {
            log.error("Failed to process telemetry: topic={}, error={}", topic, e.getMessage());
        }
    }

    /**
     * 处理网关批量遥测上报
     *
     * Topic: longarch/device/telemetry/batch/{gatewayNo}
     * Payload:
     *   {
     *     "gatewayNo": "GW-DM01",           // 可选
     *     "time": "2026-04-19 14:30:00",    // 可选批量时间，单个 sensor.data 里的 time 优先
     *     "sensors": [
     *       {"deviceNo": "SEN-ENV-DM01", "data": {"temperature": 27.3, ...}},
     *       {"deviceNo": "SEN-NPK-DM01", "data": {"N": 3.5, "P": 2.1, "K": 5.8}}
     *     ]
     *   }
     *
     * 每个 sensors 元素被拆开后复用 handleTelemetry 的单设备处理逻辑。
     */
    private void handleBatchTelemetry(String topic, String payload) {
        try {
            Map<String, Object> batch = objectMapper.readValue(payload,
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            String topicGatewayNo = mqttMessageGuard.topicSuffix(topic, mqttProperties.getTelemetryTopicPrefix());
            String payloadGatewayNo = mqttMessageGuard.stringField(batch, "gatewayNo", "gateway_no");
            if (!mqttMessageGuard.topicIdentityMatches("telemetry-batch", topicGatewayNo, payloadGatewayNo)) {
                return;
            }
            if (!mqttMessageGuard.acceptEnvelope(
                    "telemetry-batch",
                    topicGatewayNo,
                    mqttMessageGuard.stringField(batch, "msgId", "msg_id"),
                    mqttMessageGuard.longField(batch, "seq"),
                    mqttMessageGuard.longField(batch, "timestamp", "ts"))) {
                return;
            }

            Object sensorsObj = batch.get("sensors");
            if (!(sensorsObj instanceof java.util.List<?> sensorsList) || sensorsList.isEmpty()) {
                log.warn("Batch telemetry missing 'sensors' array: topic={}", topic);
                return;
            }

            String batchTime = batch.get("time") != null ? batch.get("time").toString() : null;
            String gatewayNo = payloadGatewayNo != null ? payloadGatewayNo : topicGatewayNo;

            int success = 0;
            for (Object item : sensorsList) {
                if (!(item instanceof Map<?, ?> sensorEntry)) continue;

                Object deviceNoObj = sensorEntry.get("deviceNo");
                Object dataObj = sensorEntry.get("data");
                if (deviceNoObj == null || !(dataObj instanceof Map<?, ?> dataMap)) {
                    log.warn("Invalid sensor entry in batch, skipped: {}", sensorEntry);
                    continue;
                }

                // 构造单设备 payload，batch.time 作为兜底
                Map<String, Object> singlePayload = new java.util.HashMap<>();
                for (Map.Entry<?, ?> e : dataMap.entrySet()) {
                    singlePayload.put(e.getKey().toString(), e.getValue());
                }
                if (batchTime != null && !singlePayload.containsKey("time")
                        && !singlePayload.containsKey("timestamp") && !singlePayload.containsKey("ts")) {
                    singlePayload.put("time", batchTime);
                }

                String syntheticTopic = mqttProperties.getTelemetryTopicPrefix() + deviceNoObj;
                String syntheticPayload = objectMapper.writeValueAsString(singlePayload);
                handleTelemetry(syntheticTopic, syntheticPayload, false);
                success++;
            }

            log.info("Batch telemetry processed: gatewayNo={}, sensors={}/{}", gatewayNo, success, sensorsList.size());
        } catch (Exception e) {
            log.error("Failed to process batch telemetry: topic={}, error={}", topic, e.getMessage());
        }
    }

    /**
     * 从 payload 提取采样时间，支持多种格式：
     *   "time": "23:17"          → 今天 23:17:00
     *   "time": "2026-04-15 23:17:00" → 直接解析
     *   "timestamp": 1713200000  → epoch 秒
     *   缺失                     → 当前时间
     */
    private LocalDateTime parseSampleTime(Map<String, Object> data) {
        Object timeVal = data.get("time");
        if (timeVal == null) timeVal = data.get("timestamp");
        if (timeVal == null) timeVal = data.get("ts");
        if (timeVal == null) return LocalDateTime.now();

        String timeStr = timeVal.toString().trim();

        // epoch 秒（纯数字，长度 <= 13）
        if (timeStr.matches("^\\d{10,13}$")) {
            long epoch = Long.parseLong(timeStr);
            if (epoch > 9999999999L) epoch = epoch / 1000; // 毫秒转秒
            return LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochSecond(epoch), java.time.ZoneId.systemDefault());
        }

        // HH:mm 或 HH:mm:ss → 今天的时间
        if (timeStr.matches("^\\d{1,2}:\\d{2}(:\\d{2})?$")) {
            java.time.LocalTime lt = timeStr.contains(":")
                    ? (timeStr.length() <= 5
                        ? java.time.LocalTime.parse(timeStr, java.time.format.DateTimeFormatter.ofPattern("H:mm"))
                        : java.time.LocalTime.parse(timeStr, java.time.format.DateTimeFormatter.ofPattern("H:mm:ss")))
                    : java.time.LocalTime.parse(timeStr);
            return LocalDateTime.of(java.time.LocalDate.now(), lt);
        }

        // yyyy-MM-dd HH:mm:ss
        if (timeStr.contains("-") && timeStr.contains(" ") && timeStr.contains(":")) {
            try {
                return LocalDateTime.parse(timeStr,
                        java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            } catch (Exception ignored) {}
        }

        // ISO 格式 fallback
        try {
            return LocalDateTime.parse(timeStr);
        } catch (Exception e) {
            log.warn("Unparseable time '{}', using now()", timeStr);
            return LocalDateTime.now();
        }
    }

    /**
     * 从 JSON 值中提取数值：
     *   直接数字：5.2 → BigDecimal(5.2)
     *   嵌套对象：{"value": 5.2, "unit": "mg/kg"} → BigDecimal(5.2)
     *   非数字/无 value：返回 null（跳过该字段）
     */
    @SuppressWarnings("unchecked")
    private java.math.BigDecimal extractNumericValue(Object raw) {
        if (raw == null) return null;

        // 直接是数字
        if (raw instanceof Number) {
            return new java.math.BigDecimal(raw.toString());
        }

        // 字符串形式的数字
        if (raw instanceof String) {
            try {
                return new java.math.BigDecimal((String) raw);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        // 嵌套对象 {"value": 5.2, ...}
        if (raw instanceof Map) {
            Map<String, Object> nested = (Map<String, Object>) raw;
            Object val = nested.get("value");
            if (val == null) val = nested.get("val");
            if (val instanceof Number) {
                return new java.math.BigDecimal(val.toString());
            }
            if (val instanceof String) {
                try {
                    return new java.math.BigDecimal((String) val);
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }

        return null;
    }

    /**
     * 处理设备心跳上报
     * Topic: longarch/device/heartbeat/{edgeNodeNo}
     * Payload: {"nodeNo":"EDGE-001","devices":["ACT-001","ACT-002"],"timestamp":1234567890}
     */
    private void handleHeartbeat(String topic, String payload) {
        try {
            Map<String, Object> data = objectMapper.readValue(payload, new com.fasterxml.jackson.core.type.TypeReference<>() {});
            String topicNodeNo = mqttMessageGuard.topicSuffix(topic, mqttProperties.getHeartbeatTopicPrefix());
            String nodeNo = mqttMessageGuard.stringField(data, "nodeNo", "node_no");
            if (nodeNo == null) return;
            if (!mqttMessageGuard.topicIdentityMatches("heartbeat", topicNodeNo, nodeNo, true)) {
                return;
            }
            if (!mqttMessageGuard.acceptEnvelope(
                    "heartbeat",
                    topicNodeNo,
                    mqttMessageGuard.stringField(data, "msgId", "msg_id"),
                    mqttMessageGuard.longField(data, "seq"),
                    mqttMessageGuard.longField(data, "timestamp", "ts"))) {
                return;
            }
            recordHeartbeatLatency(data);

            // 更新 edge_node 心跳时间
            // edge_node 表由 edge 模块管理，这里只更新执行器的在线状态
            LocalDateTime now = LocalDateTime.now();

            // 更新执行器在线状态
            updateEdgeNodeHeartbeat(nodeNo, data, now);
            @SuppressWarnings("unchecked")
            List<String> deviceNos = (List<String>) data.get("devices");
            int recovered = 0;
            if (deviceNos != null) {
                for (String devNo : deviceNos) {
                    com.longarch.module.task.entity.ActuatorDevice device =
                            actuatorDeviceMapper.selectOne(
                                    new LambdaQueryWrapper<com.longarch.module.task.entity.ActuatorDevice>()
                                            .eq(com.longarch.module.task.entity.ActuatorDevice::getDeviceNo, devNo));
                    if (device != null) {
                        device.setNetworkStatus("online");
                        device.setLastHeartbeatAt(now);
                        // Task gate uses deviceStatus; keep it in sync with heartbeat online signal.
                        String current = device.getDeviceStatus();
                        if (current == null
                                || "registered".equalsIgnoreCase(current)
                                || "offline".equalsIgnoreCase(current)) {
                            device.setDeviceStatus("online");
                            recovered++;
                        }
                        actuatorDeviceMapper.updateById(device);
                    }
                }
            }
            deviceObservabilityMetrics.recordHeartbeatRecovered(recovered);

            // 更新摄像头在线状态
            @SuppressWarnings("unchecked")
            List<String> cameraNos = (List<String>) data.get("cameras");
            if (cameraNos != null) {
                for (String camNo : cameraNos) {
                    CameraDevice camera = cameraDeviceMapper.selectOne(
                            new LambdaQueryWrapper<CameraDevice>()
                                    .eq(CameraDevice::getDeviceNo, camNo));
                    if (camera != null) {
                        camera.setNetworkStatus("online");
                        camera.setDeviceStatus("streaming");
                        cameraDeviceMapper.updateById(camera);
                    }
                }
            }

            log.debug("Heartbeat processed: nodeNo={}, devices={}, cameras={}", nodeNo, deviceNos, cameraNos);
        } catch (Exception e) {
            log.error("Failed to process heartbeat: topic={}, error={}", topic, e.getMessage());
        }
    }

    private void updateEdgeNodeHeartbeat(String nodeNo, Map<String, Object> payload, LocalDateTime now) {
        EdgeNode node = edgeNodeMapper.selectOne(
                new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getNodeNo, nodeNo));
        if (node == null) {
            log.warn("Heartbeat received from unknown edge node: nodeNo={}", nodeNo);
            return;
        }
        node.setNetworkStatus("online");
        String healthStatus = mqttMessageGuard.stringField(payload, "healthStatus", "health_status");
        if (healthStatus != null) {
            node.setHealthStatus(healthStatus);
        } else if (node.getHealthStatus() == null || "offline".equalsIgnoreCase(node.getHealthStatus())) {
            node.setHealthStatus("healthy");
        }
        node.setLastHeartbeatAt(now);
        edgeNodeMapper.updateById(node);
    }

    private void recordHeartbeatLatency(Map<String, Object> payload) {
        Object ts = payload.get("timestamp");
        if (ts == null) {
            ts = payload.get("ts");
        }
        if (ts == null) {
            deviceObservabilityMetrics.recordHeartbeatMissingTimestamp();
            return;
        }
        try {
            long value = Long.parseLong(String.valueOf(ts));
            if (value <= 0) {
                deviceObservabilityMetrics.recordHeartbeatMissingTimestamp();
                return;
            }
            if (value < 1_000_000_000_000L) {
                value = value * 1000L;
            }
            long nowMs = System.currentTimeMillis();
            double latency = Math.max(0D, nowMs - value);
            deviceObservabilityMetrics.recordHeartbeatLatencyMs(latency);
        } catch (Exception ex) {
            deviceObservabilityMetrics.recordHeartbeatMissingTimestamp();
        }
    }

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

    private void recordToBuffer(String direction, String topic, String payload) {
        try {
            MqttMessageBuffer.MqttLogEntry entry = new MqttMessageBuffer.MqttLogEntry();
            entry.setTimestamp(System.currentTimeMillis());
            entry.setDirection(direction);
            entry.setTopic(topic);
            entry.setPayload(payload);

            // Extract deviceNo from topic last segment
            if (topic != null && topic.contains("/")) {
                String deviceNo = topic.substring(topic.lastIndexOf('/') + 1);
                if (!deviceNo.equals("#") && !deviceNo.isBlank()) {
                    entry.setDeviceNo(deviceNo);
                    // Try to resolve plotId from device tables
                    try {
                        SensorDevice sensor = sensorDeviceMapper.selectOne(
                                new LambdaQueryWrapper<SensorDevice>().eq(SensorDevice::getDeviceNo, deviceNo));
                        if (sensor != null) {
                            entry.setPlotId(sensor.getPlotId());
                        } else {
                            com.longarch.module.task.entity.ActuatorDevice actuator = actuatorDeviceMapper.selectOne(
                                    new LambdaQueryWrapper<com.longarch.module.task.entity.ActuatorDevice>()
                                            .eq(com.longarch.module.task.entity.ActuatorDevice::getDeviceNo, deviceNo));
                            if (actuator != null) {
                                entry.setPlotId(actuator.getPlotId());
                            } else {
                                CameraDevice camera = cameraDeviceMapper.selectOne(
                                        new LambdaQueryWrapper<CameraDevice>().eq(CameraDevice::getDeviceNo, deviceNo));
                                if (camera != null) {
                                    entry.setPlotId(camera.getPlotId());
                                }
                            }
                        }
                    } catch (Exception ignored) {
                        // Non-critical: plotId resolution failure doesn't block buffer recording
                    }
                }
            }
            mqttMessageBuffer.add(entry);
        } catch (Exception e) {
            log.debug("Failed to record MQTT message to buffer: {}", e.getMessage());
        }
    }

    private SchedulerService getSchedulerService() {
        return applicationContext.getBean(SchedulerService.class);
    }
}
