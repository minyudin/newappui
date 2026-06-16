package com.longarch.module.ai.guard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.longarch.common.config.AiSafetyProperties;
import com.longarch.module.sensor.entity.SensorDevice;
import com.longarch.module.sensor.entity.SensorData;
import com.longarch.module.sensor.mapper.SensorDataMapper;
import com.longarch.module.sensor.mapper.SensorDeviceMapper;
import com.longarch.module.task.entity.OperationTask;
import com.longarch.module.task.mapper.OperationTaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 操作安全守卫：即使AI建议执行操作，程序层面也要做硬性安全校验
 * - 防止高湿度下浇水（涝死作物）
 * - 防止施肥间隔过短（烧苗）
 * - 防止短时间内重复操作同一设备
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OperationSafetyGuard {

    private final SensorDeviceMapper sensorDeviceMapper;
    private final SensorDataMapper sensorDataMapper;
    private final OperationTaskMapper operationTaskMapper;
    private final AiSafetyProperties safetyProperties;

    private static final BigDecimal SOIL_MOISTURE_TOO_LOW = new BigDecimal("20");
    private static final List<String> SOIL_MOISTURE_ALIASES = List.of(
            "soil_moisture", "soil_moist", "soil_humidity", "soilhumidity", "soilmoisture", "vwc"
    );
    private static final List<String> AIR_TEMP_ALIASES = List.of(
            "air_temperature", "air_temp", "temperature", "temp"
    );

    /**
     * 校验操作是否安全，返回拦截原因列表（空=安全）
     */
    public SafetyCheckResult check(Long plotId, String actionType) {
        SafetyCheckResult result = new SafetyCheckResult();

        switch (actionType) {
            case "irrigation_apply" -> checkIrrigation(plotId, result);
            case "fertilize_apply" -> checkFertilize(plotId, result);
            case "spray_apply" -> checkSpray(plotId, result);
        }

        // 通用检查：同类型操作短时间内是否重复
        checkRecentDuplicate(plotId, actionType, result);

        if (result.isBlocked()) {
            log.warn("OperationSafetyGuard BLOCKED: plotId={}, action={}, reasons={}", plotId, actionType, result.getReasons());
        }
        return result;
    }

    private void checkIrrigation(Long plotId, SafetyCheckResult result) {
        BigDecimal blockHigh = BigDecimal.valueOf(safetyProperties.getSoilMoistureBlockHigh());
        BigDecimal warnHigh = BigDecimal.valueOf(safetyProperties.getSoilMoistureWarnHigh());
        SensorReading reading = getLatestSensorReading(plotId, SOIL_MOISTURE_ALIASES);
        if (reading == null) {
            result.warn("未匹配到土壤湿度指标（已按别名兼容匹配），将按低置信度继续，建议人工确认后再执行");
            return;
        }
        if (reading.isStale) {
            result.warn(String.format("土壤湿度数据已过时（%d分钟前采样），建议先刷新传感器再执行浇水",
                    reading.minutesAgo));
        }
        if (reading.value.compareTo(blockHigh) > 0) {
            result.block(String.format("土壤湿度已达%.1f%%（>%.1f%%），继续浇水可能导致涝害，操作被拦截", reading.value, blockHigh));
        } else if (reading.value.compareTo(warnHigh) > 0) {
            result.warn(String.format("土壤湿度%.1f%%偏高（>%.1f%%），浇水需谨慎", reading.value, warnHigh));
        }
    }

    private void checkFertilize(Long plotId, SafetyCheckResult result) {
        // 检查上次施肥时间间隔
        OperationTask lastFertilize = operationTaskMapper.selectOne(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getPlotId, plotId)
                        .eq(OperationTask::getActionType, "fertilize_apply")
                        .in(OperationTask::getTaskStatus, "success", "running", "queued")
                        .orderByDesc(OperationTask::getCreatedAt)
                        .last("LIMIT 1"));
        if (lastFertilize != null && lastFertilize.getCreatedAt() != null) {
            long hoursAgo = java.time.Duration.between(lastFertilize.getCreatedAt(), LocalDateTime.now()).toHours();
            if (hoursAgo < safetyProperties.getMinFertilizeIntervalHours()) {
                result.block(String.format("距上次施肥仅%d小时（最小间隔%d小时），过度施肥会烧苗，操作被拦截",
                        hoursAgo, safetyProperties.getMinFertilizeIntervalHours()));
            }
        }
    }

    private void checkSpray(Long plotId, SafetyCheckResult result) {
        SensorReading reading = getLatestSensorReading(plotId, AIR_TEMP_ALIASES);
        if (reading != null && reading.isStale) {
            result.warn(String.format("气温传感器数据已过时（%d分钟前），喷淋安全判断可能不准确", reading.minutesAgo));
        }
        if (reading != null && !reading.isStale && reading.value.compareTo(new BigDecimal("35")) > 0) {
            result.warn(String.format("当前气温%.1f℃偏高，高温喷淋可能造成叶面灼伤", reading.value));
        }
    }

    private void checkRecentDuplicate(Long plotId, String actionType, SafetyCheckResult result) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(safetyProperties.getMinSameActionIntervalMinutes());
        Long recentCount = operationTaskMapper.selectCount(
                new LambdaQueryWrapper<OperationTask>()
                        .eq(OperationTask::getPlotId, plotId)
                        .eq(OperationTask::getActionType, actionType)
                        .ne(OperationTask::getTaskStatus, "cancelled")
                        .ge(OperationTask::getCreatedAt, threshold));
        if (recentCount != null && recentCount > 0) {
            result.block(String.format("最近%d分钟内已有%d个同类型任务，短间隔重复操作已被拦截，请稍后再试",
                    safetyProperties.getMinSameActionIntervalMinutes(), recentCount));
        }
    }

    private SensorReading getLatestSensorReading(Long plotId, List<String> aliases) {
        // 1) 先看 sensor_data 最近上报，优先匹配 metric key（最准确）
        List<SensorData> latestData = sensorDataMapper.selectList(
                new LambdaQueryWrapper<SensorData>()
                        .eq(SensorData::getPlotId, plotId)
                        .orderByDesc(SensorData::getSampleAt)
                        .last("LIMIT 200"));
        for (SensorData d : latestData) {
            if (d.getValue() == null) continue;
            if (!isAliasMatch(d.getSensorType(), aliases)) continue;
            long minutesAgo = d.getSampleAt() != null ? Duration.between(d.getSampleAt(), LocalDateTime.now()).toMinutes() : Long.MAX_VALUE;
            return new SensorReading(d.getValue(), minutesAgo > safetyProperties.getDataStaleThresholdMinutes(), minutesAgo);
        }

        // 2) 回退到 sensor_device.last_value（兼容旧口径）
        List<SensorDevice> devices = sensorDeviceMapper.selectList(
                new LambdaQueryWrapper<SensorDevice>()
                        .eq(SensorDevice::getPlotId, plotId)
                        .eq(SensorDevice::getStatus, "online")
                        .orderByDesc(SensorDevice::getLastSampleAt)
                        .last("LIMIT 50"));
        for (SensorDevice s : devices) {
            if (s.getLastValue() == null) continue;
            if (!(isAliasMatch(s.getSensorType(), aliases) || isAliasMatch(s.getSensorName(), aliases))) continue;
            long minutesAgo = s.getLastSampleAt() != null ? Duration.between(s.getLastSampleAt(), LocalDateTime.now()).toMinutes() : Long.MAX_VALUE;
            return new SensorReading(s.getLastValue(), minutesAgo > safetyProperties.getDataStaleThresholdMinutes(), minutesAgo);
        }
        return null;
    }

    private boolean isAliasMatch(String raw, List<String> aliases) {
        if (raw == null || raw.isBlank()) return false;
        String n = normalize(raw);
        for (String alias : aliases) {
            String a = normalize(alias);
            if (n.equals(a) || n.contains(a)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String text) {
        if (text == null) return "";
        return text.toLowerCase()
                .replaceAll("[^a-z0-9\\u4e00-\\u9fa5]", "");
    }

    private record SensorReading(BigDecimal value, boolean isStale, long minutesAgo) {}

    public static class SafetyCheckResult {
        private boolean blocked = false;
        private final List<String> reasons = new ArrayList<>();
        private final List<String> warnings = new ArrayList<>();

        public void block(String reason) { blocked = true; reasons.add(reason); }
        public void warn(String warning) { warnings.add(warning); }
        public boolean isBlocked() { return blocked; }
        public List<String> getReasons() { return reasons; }
        public List<String> getWarnings() { return warnings; }
        public boolean hasWarnings() { return !warnings.isEmpty(); }

        public String toUserMessage() {
            if (blocked) return "⚠️ 操作被安全系统拦截：" + String.join("；", reasons);
            if (hasWarnings()) return "⚠️ 安全提醒：" + String.join("；", warnings);
            return null;
        }
    }
}
