package com.longarch.module.sensor.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class SensorSummaryVO {

    private Long plotId;
    private List<SummaryItem> summary;

    @Data
    public static class SummaryItem {
        private String sensorType;
        private String label;
        private BigDecimal value;
        private String unit;
        private String sampleAt;
    }
}
