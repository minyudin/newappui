package com.longarch.module.edge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.enums.DeviceExecutionState;
import com.longarch.common.enums.ErrorCode;
import com.longarch.common.enums.TaskStatus;
import com.longarch.common.exception.BizException;
import com.longarch.module.edge.dto.EdgeRegisterReq;
import com.longarch.module.edge.dto.ExecutionCallbackReq;
import com.longarch.module.edge.dto.HeartbeatReq;
import com.longarch.module.edge.dto.SensorReportReq;
import com.longarch.module.edge.entity.EdgeNode;
import com.longarch.module.edge.mapper.EdgeNodeMapper;
import com.longarch.module.edge.service.EdgeNodeService;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.DeviceExecutionLog;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.DeviceExecutionLogMapper;
import com.longarch.module.task.mapper.OperationTaskMapper;
import com.longarch.module.task.service.SchedulerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class EdgeNodeServiceImpl implements EdgeNodeService {

    private final EdgeNodeMapper edgeNodeMapper;
    private final SensorDataMapper sensorDataMapper;
    private final SensorDeviceMapper sensorDeviceMapper;
    private final OperationTaskMapper taskMapper;
    private final DeviceExecutionLogMapper executionLogMapper;
    private final SchedulerService schedulerService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public void register(EdgeRegisterReq req) {
        log.info("Edge node register: nodeNo={}", req.getNodeNo());

        EdgeNode existing = edgeNodeMapper.selectOne(
                new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getNodeNo, req.getNodeNo()));

        if (existing != null) {
            existing.setNodeName(req.getNodeName());
            existing.setHardwareType(req.getHardwareType());
            existing.setOsVersion(req.getOsVersion());
            existing.setRuntimeVersion(req.getRuntimeVersion());
            existing.setNetworkStatus("online");
            existing.setHealthStatus("healthy");
            existing.setLastHeartbeatAt(LocalDateTime.now());
            edgeNodeMapper.updateById(existing);
        } else {
            EdgeNode node = new EdgeNode();
            node.setNodeNo(req.getNodeNo());
            node.setFarmId(req.getFarmId());
            node.setNodeName(req.getNodeName());
            node.setHardwareType(req.getHardwareType());
            node.setOsVersion(req.getOsVersion());
            node.setRuntimeVersion(req.getRuntimeVersion());
            node.setNetworkStatus("online");
            node.setHealthStatus("healthy");
            node.setLastHeartbeatAt(LocalDateTime.now());
            edgeNodeMapper.insert(node);
        }
    }

    @Override
    public void heartbeat(String nodeNo, HeartbeatReq req) {
        EdgeNode node = edgeNodeMapper.selectOne(
                new LambdaQueryWrapper<EdgeNode>().eq(EdgeNode::getNodeNo, nodeNo));
        if (node == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "边缘节点不存在");
        }

        node.setNetworkStatus(req.getNetworkStatus());
        node.setHealthStatus(req.getHealthStatus());
        node.setLocalStorageFreeMb(req.getLocalStorageFreeMb());
        node.setLastHeartbeatAt(LocalDateTime.now());
        edgeNodeMapper.updateById(node);
    }

    @Override
    @Transactional
    public void reportSensorData(SensorReportReq req) {
        log.info("Sensor data report: nodeNo={}, plotId={}, items={}", req.getNodeNo(), req.getPlotId(),
                req.getItems() != null ? req.getItems().size() : 0);

        if (req.getItems() == null) return;

        for (SensorReportReq.SensorItem item : req.getItems()) {
            SensorData data = new SensorData();
            data.setSensorId(item.getSensorId());
            data.setPlotId(req.getPlotId());
            data.setSensorType(item.getSensorType());
            data.setValue(item.getValue());
            data.setSampleAt(LocalDateTime.parse(item.getSampleAt(), FMT));
            sensorDataMapper.insert(data);

            // 更新传感器设备最新值及在线状态
            SensorDevice device = sensorDeviceMapper.selectById(item.getSensorId());
            if (device != null) {
                device.setLastValue(item.getValue());
                device.setLastSampleAt(LocalDateTime.parse(item.getSampleAt(), FMT));
                device.setStatus("online");
                sensorDeviceMapper.updateById(device);
            }
        }
    }

    @Override
    @Transactional
    public void executionCallback(ExecutionCallbackReq req) {
        log.info("Execution callback: taskId={}, deviceId={}, state={}", req.getTaskId(), req.getDeviceId(), req.getExecutionState());

        OperationTask task = taskMapper.selectById(req.getTaskId());
        if (task == null) {
            throw new BizException(ErrorCode.RESOURCE_NOT_FOUND, "任务不存在");
        }

        // 状态机校验：已终态的任务不再接受回调
        TaskStatus currentStatus = TaskStatus.valueOf(task.getTaskStatus().toUpperCase());
        if (currentStatus.isTerminal()) {
            log.warn("Task already in terminal state: taskId={}, status={}", req.getTaskId(), currentStatus);
            return;
        }

        String execState = req.getExecutionState();
        task.setDeviceExecutionState(execState);

        switch (execState) {
            case "accepted":
                task.setDeviceExecutionState(DeviceExecutionState.RUNNING.getValue());
                break;
            case "running":
                task.setTaskStatus(TaskStatus.RUNNING.getValue());
                task.setDeviceExecutionState(DeviceExecutionState.RUNNING.getValue());
                if (req.getStartedAt() != null) {
                    task.setStartedAt(LocalDateTime.parse(req.getStartedAt(), FMT));
                }
                break;
            case "success":
                task.setTaskStatus(TaskStatus.SUCCESS.getValue());
                task.setDeviceExecutionState(DeviceExecutionState.SUCCESS.getValue());
                task.setCancelable(0);
                if (req.getFinishedAt() != null) {
                    task.setFinishedAt(LocalDateTime.parse(req.getFinishedAt(), FMT));
                } else {
                    task.setFinishedAt(LocalDateTime.now());
                }
                break;
            case "failed":
                task.setTaskStatus(TaskStatus.FAILED.getValue());
                task.setDeviceExecutionState(DeviceExecutionState.FAILED.getValue());
                task.setFailReason(req.getRemark());
                task.setCancelable(0);
                task.setFinishedAt(LocalDateTime.now());
                break;
            case "network_pending_confirmation":
                task.setDeviceExecutionState(DeviceExecutionState.NETWORK_PENDING_CONFIRMATION.getValue());
                break;
            default:
                log.warn("Unknown executionState: {}", execState);
                return;
        }

        taskMapper.updateById(task);

        // 更新或创建 device_execution_log
        updateExecutionLog(task, req);

        // 成功或失败后自动出队下一个任务
        if ("success".equals(execState) || "failed".equals(execState)) {
            schedulerService.dispatchNext(req.getDeviceId());
        }
    }

    private void updateExecutionLog(OperationTask task, ExecutionCallbackReq req) {
        try {
            DeviceExecutionLog logEntry = executionLogMapper.selectOne(
                    new LambdaQueryWrapper<DeviceExecutionLog>()
                            .eq(DeviceExecutionLog::getTaskId, task.getId())
                            .last("LIMIT 1"));

            if (logEntry == null) {
                // MQTT dispatch 没走过，HTTP 直接回调，需新建记录
                logEntry = new DeviceExecutionLog();
                logEntry.setTaskId(task.getId());
                logEntry.setDeviceId(req.getDeviceId());
                logEntry.setActionType(task.getActionType());
                logEntry.setDispatchedAt(task.getStartedAt());
            }

            String callbackJson = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(req);
            logEntry.setCallbackPayload(callbackJson);
            logEntry.setCallbackAt(LocalDateTime.now());
            logEntry.setExecutionStatus(req.getExecutionState());

            if (logEntry.getDispatchedAt() != null) {
                long seconds = java.time.Duration.between(logEntry.getDispatchedAt(), LocalDateTime.now()).getSeconds();
                logEntry.setActualDurationSeconds((int) seconds);
            }

            if (logEntry.getId() == null) {
                executionLogMapper.insert(logEntry);
            } else {
                executionLogMapper.updateById(logEntry);
            }
        } catch (Exception e) {
            log.warn("Failed to update execution log for taskId={}: {}", task.getId(), e.getMessage());
        }
    }
}
