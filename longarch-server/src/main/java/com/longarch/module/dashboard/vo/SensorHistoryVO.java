package com.longarch.module.dashboard.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class SensorHistoryVO {

    private List<DataPoint> temperature;
    private List<DataPoint> humidity;
    private List<DataPoint> light;
    private List<DataPoint> co2;

    private List<SensorSeriesVO> series;

    @Data
    public static class DataPoint {
        private String time;
        private BigDecimal value;

        public DataPoint() {}

        public DataPoint(String time, BigDecimal value) {
            this.time = time;
            this.value = value;
        }
    }
}
