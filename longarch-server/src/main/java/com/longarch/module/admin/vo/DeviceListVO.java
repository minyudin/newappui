package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class DeviceListVO {
    private Long deviceId;
    private String deviceNo;
    private String deviceName;
    private Long plotId;
    /** 解析后的地块名 (若无则 "—") */
    private String plotName;
    private String deviceType;
    private String deviceStatus;
    private String networkStatus;
    private String lastHeartbeatAt;
    private Long heartbeatAgeSeconds;
    private String lockStatus;
    private Long currentTaskId;
    private String createdAt;
}
