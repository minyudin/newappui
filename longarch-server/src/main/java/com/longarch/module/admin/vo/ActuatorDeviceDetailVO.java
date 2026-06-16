package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class ActuatorDeviceDetailVO {

    private Long deviceId;
    private String deviceNo;
    private String deviceName;
    private Long plotId;
    private String deviceType;
    private String deviceStatus;
    private String lockStatus;
    private Long currentTaskId;
    private String lockedAt;
    private String lockExpireAt;
}
