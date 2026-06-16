package com.longarch.module.task.scheduler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.longarch.common.config.MqttProperties;
import com.longarch.common.metrics.DeviceObservabilityMetrics;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Keep actuator online/offline status aligned with MQTT heartbeat freshness.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceHeartbeatStatusScheduler {

    private final ActuatorDeviceMapper actuatorDeviceMapper;
    private final MqttProperties mqttProperties;
    private final DeviceObservabilityMetrics deviceObservabilityMetrics;

    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void markOfflineWhenHeartbeatExpired() {
        long timeoutSeconds = Math.max(30, mqttProperties.getHeartbeatOfflineTimeoutSeconds());
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(timeoutSeconds);

        List<ActuatorDevice> staleDevices = actuatorDeviceMapper.selectList(
                new LambdaQueryWrapper<ActuatorDevice>()
                        .isNotNull(ActuatorDevice::getLastHeartbeatAt)
                        .lt(ActuatorDevice::getLastHeartbeatAt, threshold)
                        .in(ActuatorDevice::getDeviceStatus, "online", "idle", "running"));

        if (staleDevices.isEmpty()) {
            return;
        }

        int updatedCount = 0;
        for (ActuatorDevice stale : staleDevices) {
            int updated = actuatorDeviceMapper.update(
                    null,
                    new LambdaUpdateWrapper<ActuatorDevice>()
                            .eq(ActuatorDevice::getId, stale.getId())
                            .lt(ActuatorDevice::getLastHeartbeatAt, threshold)
                            .in(ActuatorDevice::getDeviceStatus, "online", "idle", "running")
                            .set(ActuatorDevice::getDeviceStatus, "offline")
                            .set(ActuatorDevice::getNetworkStatus, "offline"));
            if (updated > 0) {
                updatedCount += updated;
            }
        }

        if (updatedCount > 0) {
            deviceObservabilityMetrics.recordOfflineTransition(updatedCount);
            log.warn("Marked stale actuator devices offline: count={}, timeoutSeconds={}", updatedCount, timeoutSeconds);
        }
    }
}
