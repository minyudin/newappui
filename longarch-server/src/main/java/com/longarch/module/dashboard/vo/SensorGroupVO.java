package com.longarch.module.dashboard.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SensorGroupVO {

    private Long sensorId;
    private String deviceNo;
    private String sensorName;
    private String sensorType;
    private String category;
    private BigDecimal latestValue;
    private String unit;
    private String status;
    private String lastSampleAt;
}
