package com.longarch.module.camera.vo;

import lombok.Data;

@Data
public class PlaybackUrlVO {

    private Long cameraId;
    private String playbackUrl;
    private String startTime;
    private String endTime;
}
