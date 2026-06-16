package com.longarch.module.task.mqtt;

import lombok.Data;

import java.util.Map;

/**
 * MQTT 下发到边缘设备的指令格式
 * Topic: longarch/device/command/{deviceNo}
 */
@Data
public class DeviceCommand {

    private Long taskId;
    private String taskNo;
    private Long deviceId;
    private String deviceNo;
    private String actionType;
    private Map<String, Object> actionParams;
    private String callbackTopic;
    private long timestamp;
    private long expiresAt;
}
