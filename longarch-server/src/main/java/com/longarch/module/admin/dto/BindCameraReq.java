package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindCameraReq {

    private String deviceNo;

    @NotBlank(message = "摄像头名称不能为空")
    private String cameraName;

    @NotBlank(message = "推流协议不能为空(rtmp/rtsp)")
    private String streamProtocol;

    private Boolean playbackEnabled;

    /** 摄像头 RTMP 推流地址，如 rtmp://media:1935/live/CAM-001 */
    private String rtmpPushUrl;

    /** 流媒体应用名，默认 live */
    private String streamApp;

    /** 流名称，默认为 deviceNo */
    private String streamName;
}
