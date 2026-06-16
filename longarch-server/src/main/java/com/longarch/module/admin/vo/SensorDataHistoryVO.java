package com.longarch.module.admin.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SensorDataHistoryVO {

    private Long id;
    private Long sensorId;
    private String sensorType;
    private BigDecimal value;
    private String sampleAt;
}
