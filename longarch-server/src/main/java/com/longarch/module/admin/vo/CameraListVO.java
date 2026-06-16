package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class CameraListVO {

    private Long cameraId;
    private String deviceNo;
    private String cameraName;
    private Long plotId;
    private String plotName;
    private String streamProtocol;
    private String streamApp;
    private String streamName;
    private String rtmpPushUrl;
    private String flvPlayUrl;
    private String hlsPlayUrl;
    private Boolean playbackEnabled;
    private Boolean ptzEnabled;
    private String networkStatus;
    private String deviceStatus;
    private String snapshotUrl;
    private String createdAt;
    /** 是否正在推流（实时查询 SRS） */
    private Boolean streaming;
}
