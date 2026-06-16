package com.longarch.module.camera.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("camera_device")
public class CameraDevice {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String deviceNo;
    private String cameraName;
    private Long plotId;
    private String streamProtocol;
    private Integer playbackEnabled;
    private Integer ptzEnabled;
    private Integer micEnabled;
    private String networkStatus;
    private String deviceStatus;
    private String snapshotUrl;
    private String rtmpPushUrl;
    private String streamApp;
    private String streamName;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
