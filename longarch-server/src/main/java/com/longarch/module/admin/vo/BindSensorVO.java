package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class BindSensorVO {
    private Long plotId;
    private Long sensorId;
    private String deviceNo;
    private String sensorName;
    private String sensorType;
    private String category;
    private String unit;
    private String mqttTopic;
    private boolean bindSuccess;
    private String status;
    private String boundAt;
}
