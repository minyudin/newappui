package com.longarch.module.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("device_lifecycle_log")
public class DeviceLifecycleLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String deviceKind; // actuator/sensor/camera/screen
    private Long deviceId;
    private String deviceNo;
    private Long plotId;

    private String action; // retire/replace/bind
    private String reason;
    private Long operatorId;

    private String beforeJson;
    private String afterJson;

    private LocalDateTime createdAt;
}

