package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class BindCameraVO {

    private Long plotId;
    private Long cameraId;
    private String deviceNo;
    private String cameraName;
    private String rtmpPushUrl;
    private Boolean bindSuccess;
    private String deviceStatus;
    private String networkStatus;
    private String boundAt;
}
