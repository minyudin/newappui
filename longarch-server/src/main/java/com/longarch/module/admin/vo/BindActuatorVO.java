package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class BindActuatorVO {

    private Long plotId;
    private Long deviceId;
    private String deviceName;
    private String deviceType;
    private Boolean bindSuccess;
    private String status;
    private String boundAt;
}
