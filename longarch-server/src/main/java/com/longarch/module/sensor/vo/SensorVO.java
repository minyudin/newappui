package com.longarch.module.sensor.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SensorVO {

    private Long sensorId;
    private String deviceNo;
    private String sensorType;
    private String sensorName;
    private String unit;
    private String status;
    private BigDecimal lastValue;
    private String lastSampleAt;
}
