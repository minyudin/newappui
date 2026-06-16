package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("actuator_device")
public class ActuatorDevice {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String deviceNo;
    private String deviceName;
    private Long plotId;
    private String deviceType;
    private String deviceStatus;
    private String edgeNodeNo;
    private String networkStatus;
    private LocalDateTime lastHeartbeatAt;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
