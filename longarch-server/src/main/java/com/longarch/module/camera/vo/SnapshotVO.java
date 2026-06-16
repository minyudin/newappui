package com.longarch.module.camera.vo;

import lombok.Data;

@Data
public class SnapshotVO {

    private Long cameraId;
    private String snapshotUrl;
    private String capturedAt;
}
