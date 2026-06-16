package com.longarch.module.admin.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

@Data
public class SensorDeviceListVO {

    private Long sensorId;
    private String deviceNo;
    private String sensorName;
    private String sensorType;
    private String category;
    private String unit;
    private String status;
    private Long plotId;
    private String plotName;
    private BigDecimal lastValue;
    private String lastSampleAt;
    private Map<String, Object> latestMetrics;
}
