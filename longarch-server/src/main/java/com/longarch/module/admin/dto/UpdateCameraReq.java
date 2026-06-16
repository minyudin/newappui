package com.longarch.module.admin.dto;

import lombok.Data;

@Data
public class UpdateCameraReq {

    private String cameraName;
    private String streamProtocol;
    private String streamApp;
    private String streamName;
    private String rtmpPushUrl;
    private Boolean playbackEnabled;
    private Boolean ptzEnabled;
}
