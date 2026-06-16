package com.longarch.module.sensor.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class SensorHistoryVO {

    private Long sensorId;
    private String sensorType;
    /**
     * 生产模式: 多指标序列 (ph / soilTemp / soilMoisture ...)
     */
    private List<Series> series;
    /**
     * 兼容旧端: 单序列 points (默认取第一条 series)
     */
    private List<Point> points;

    @Data
    public static class Point {
        private String sampleAt;
        private BigDecimal value;
    }

    @Data
    public static class Series {
        private String metricKey;
        private List<Point> points;
    }
}
