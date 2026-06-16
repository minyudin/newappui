package com.longarch.common.metrics;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.module.task.entity.ActuatorDevice;
import com.longarch.module.task.mapper.ActuatorDeviceMapper;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Slf4j
@Component
public class DeviceObservabilityMetrics {

    @Nullable
    private final MeterRegistry meterRegistry;
    private final ActuatorDeviceMapper actuatorDeviceMapper;

    public DeviceObservabilityMetrics(
            @Nullable MeterRegistry meterRegistry,
            ActuatorDeviceMapper actuatorDeviceMapper) {
        this.meterRegistry = meterRegistry;
        this.actuatorDeviceMapper = actuatorDeviceMapper;
        registerGauges();
    }

    private void registerGauges() {
        if (meterRegistry == null) {
            return;
        }
        Gauge.builder("longarch_device_total", this, DeviceObservabilityMetrics::countAllDevices)
                .description("Current actuator device count")
                .register(meterRegistry);
        Gauge.builder("longarch_device_online_total", this, DeviceObservabilityMetrics::countOnlineDevices)
                .description("Current online actuator device count")
                .register(meterRegistry);
        Gauge.builder("longarch_device_offline_ratio", this, DeviceObservabilityMetrics::offlineRatio)
                .description("Offline ratio for actuator devices")
                .register(meterRegistry);
    }

    public void recordOfflineTransition(int count) {
        if (meterRegistry == null || count <= 0) {
            return;
        }
        Counter.builder("longarch_device_offline_transitions_total")
                .description("Times devices transitioned to offline by heartbeat timeout")
                .register(meterRegistry)
                .increment(count);
    }

    public void recordHeartbeatRecovered(int count) {
        if (meterRegistry == null || count <= 0) {
            return;
        }
        Counter.builder("longarch_heartbeat_recoveries_total")
                .description("Times heartbeat marked device online")
                .register(meterRegistry)
                .increment(count);
    }

    public void recordHeartbeatLatencyMs(double latencyMs) {
        if (meterRegistry == null || latencyMs < 0) {
            return;
        }
        io.micrometer.core.instrument.DistributionSummary.builder("longarch_heartbeat_latency_ms")
                .description("Heartbeat ingestion latency in milliseconds")
                .publishPercentiles(0.95, 0.99)
                .distributionStatisticExpiry(Duration.ofMinutes(10))
                .register(meterRegistry)
                .record(latencyMs);
    }

    public void recordHeartbeatMissingTimestamp() {
        if (meterRegistry == null) {
            return;
        }
        Counter.builder("longarch_heartbeat_missing_timestamp_total")
                .description("Heartbeat payload missing parseable timestamp")
                .register(meterRegistry)
                .increment();
    }

    public void recordGateDecision(String decision, String actionType, String deviceStatus, String networkStatus) {
        if (meterRegistry == null) {
            return;
        }
        Counter.builder("longarch_task_gate_decisions_total")
                .description("Task gate decisions at createTask")
                .tag("decision", blankAsUnknown(decision))
                .tag("action", blankAsUnknown(actionType))
                .tag("device_status", blankAsUnknown(deviceStatus))
                .tag("network_status", blankAsUnknown(networkStatus))
                .register(meterRegistry)
                .increment();
    }

    public void recordGateMisjudge(String type, String actionType) {
        if (meterRegistry == null) {
            return;
        }
        Counter.builder("longarch_task_gate_misjudge_total")
                .description("Task gate misjudgment counters")
                .tag("type", blankAsUnknown(type))
                .tag("action", blankAsUnknown(actionType))
                .register(meterRegistry)
                .increment();
    }

    private double countAllDevices() {
        try {
            Long count = actuatorDeviceMapper.selectCount(new LambdaQueryWrapper<>());
            return count != null ? count.doubleValue() : 0D;
        } catch (Exception e) {
            log.debug("Count all devices gauge failed: {}", e.getMessage());
            return 0D;
        }
    }

    private double countOnlineDevices() {
        try {
            Long count = actuatorDeviceMapper.selectCount(
                    new LambdaQueryWrapper<ActuatorDevice>()
                            .in(ActuatorDevice::getDeviceStatus, "online", "idle", "running"));
            return count != null ? count.doubleValue() : 0D;
        } catch (Exception e) {
            log.debug("Count online devices gauge failed: {}", e.getMessage());
            return 0D;
        }
    }

    private double offlineRatio() {
        double total = countAllDevices();
        if (total <= 0D) {
            return 0D;
        }
        double online = countOnlineDevices();
        return Math.max(0D, Math.min(1D, (total - online) / total));
    }

    private String blankAsUnknown(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value;
    }
}
