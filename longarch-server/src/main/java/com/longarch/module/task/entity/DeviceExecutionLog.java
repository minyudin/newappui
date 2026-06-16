package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("device_execution_log")
public class DeviceExecutionLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;
    private Long deviceId;
    private String deviceNo;
    private String actionType;
    private String commandPayload;
    private String callbackPayload;
    private String callbackMsgId;
    private String callbackDedupeKey;
    private String executionStatus;
    private String sensorBefore;
    private String sensorAfter;
    private Integer actualDurationSeconds;
    private LocalDateTime dispatchedAt;
    private LocalDateTime callbackAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
