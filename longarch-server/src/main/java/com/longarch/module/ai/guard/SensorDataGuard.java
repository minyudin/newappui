package com.longarch.module.ai.guard;

import com.longarch.module.sensor.entity.SensorDevice;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 传感器数据守卫：在AI分析前对传感器数据进行质量评估
 * - 检查传感器在线状态
 * - 检查数据新鲜度（超过2小时标记过时）
 * - 检查异常值范围
 */
@Slf4j
@Component
public class SensorDataGuard {

    private static final long STALE_THRESHOLD_MINUTES = 120;

    private static final Map<String, BigDecimal[]> VALID_RANGES = Map.of(
            "soil_temperature", new BigDecimal[]{new BigDecimal("-10"), new BigDecimal("60")},
            "soil_humidity", new BigDecimal[]{new BigDecimal("0"), new BigDecimal("100")},
            "soil_ph", new BigDecimal[]{new BigDecimal("3"), new BigDecimal("10")},
            "air_temperature", new BigDecimal[]{new BigDecimal("-30"), new BigDecimal("55")},
            "air_humidity", new BigDecimal[]{new BigDecimal("0"), new BigDecimal("100")},
            "temperature", new BigDecimal[]{new BigDecimal("-30"), new BigDecimal("55")},
            "humidity", new BigDecimal[]{new BigDecimal("0"), new BigDecimal("100")},
            "soil_moisture", new BigDecimal[]{new BigDecimal("0"), new BigDecimal("100")}
    );

    /**
     * 评估传感器列表的数据质量，返回质量报告（注入到AI prompt中）
     */
    public SensorQualityReport evaluate(List<SensorDevice> sensors) {
        SensorQualityReport report = new SensorQualityReport();
        LocalDateTime now = LocalDateTime.now();

        if (sensors == null || sensors.isEmpty()) {
            report.addWarning("该地块没有任何传感器数据，AI分析可信度极低");
            report.setOverallReliability("very_low");
            return report;
        }

        int onlineCount = 0;
        int staleCount = 0;
        int anomalyCount = 0;

        for (SensorDevice sensor : sensors) {
            // 1. 在线状态检查
            if (!"online".equals(sensor.getStatus())) {
                report.addWarning(String.format("传感器[%s]当前离线，数据不可靠", sensor.getSensorName()));
                continue;
            }
            onlineCount++;

            // 2. 数据新鲜度检查
            if (sensor.getLastSampleAt() != null) {
                long minutesAgo = Duration.between(sensor.getLastSampleAt(), now).toMinutes();
                if (minutesAgo > STALE_THRESHOLD_MINUTES) {
                    staleCount++;
                    report.addWarning(String.format("传感器[%s]数据已过时（%d分钟前采样），请注意数据时效性",
                            sensor.getSensorName(), minutesAgo));
                }
            } else {
                staleCount++;
                report.addWarning(String.format("传感器[%s]没有采样时间记录", sensor.getSensorName()));
            }

            // 3. 异常值范围检查
            if (sensor.getLastValue() != null) {
                BigDecimal[] range = VALID_RANGES.get(sensor.getSensorType());
                if (range != null) {
                    BigDecimal val = sensor.getLastValue();
                    if (val.compareTo(range[0]) < 0 || val.compareTo(range[1]) > 0) {
                        anomalyCount++;
                        report.addWarning(String.format("传感器[%s]数值异常: %s %s（正常范围: %s~%s），可能是设备故障",
                                sensor.getSensorName(), val, sensor.getUnit(), range[0], range[1]));
                    }
                }
            }
        }

        // 总体可靠性评估
        int totalSensors = sensors.size();
        if (onlineCount == 0) {
            report.setOverallReliability("very_low");
            report.addWarning("所有传感器均离线，AI分析仅供参考，不建议执行操作");
        } else if (staleCount > totalSensors / 2 || anomalyCount > 0) {
            report.setOverallReliability("low");
            report.addWarning("部分传感器数据异常或过时，AI建议需人工核实");
        } else if (staleCount > 0) {
            report.setOverallReliability("medium");
        } else {
            report.setOverallReliability("high");
        }

        log.info("SensorDataGuard: plotSensors={}, online={}, stale={}, anomaly={}, reliability={}",
                totalSensors, onlineCount, staleCount, anomalyCount, report.getOverallReliability());

        return report;
    }

    public static class SensorQualityReport {
        private String overallReliability = "high";
        private final List<String> warnings = new ArrayList<>();

        public void addWarning(String warning) { warnings.add(warning); }
        public void setOverallReliability(String r) { this.overallReliability = r; }
        public String getOverallReliability() { return overallReliability; }
        public List<String> getWarnings() { return warnings; }
        public boolean hasWarnings() { return !warnings.isEmpty(); }

        public String toPromptText() {
            if (!hasWarnings()) return "【数据质量】所有传感器在线且数据正常\n";
            StringBuilder sb = new StringBuilder("【⚠️ 数据质量警告 - 整体可靠性: " + overallReliability + "】\n");
            for (String w : warnings) {
                sb.append("- ").append(w).append("\n");
            }
            sb.append("请在分析中明确说明数据质量问题对判断的影响。\n");
            return sb.toString();
        }
    }
}
