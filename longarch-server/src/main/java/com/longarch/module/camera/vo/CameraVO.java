package com.longarch.module.camera.vo;

import lombok.Data;

@Data
public class CameraVO {

    private Long cameraId;
    private String deviceNo;
    private String cameraName;
    private String streamProtocol;
    private Boolean playbackEnabled;
    private Boolean ptzEnabled;
    private Boolean micEnabled;
    private String networkStatus;
    private String deviceStatus;
    private String snapshotUrl;
}
