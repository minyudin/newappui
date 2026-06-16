package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("device_lock")
public class DeviceLock {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long deviceId;
    private Long currentTaskId;
    private String lockOwner;
    private LocalDateTime lockedAt;
    private LocalDateTime lockExpireAt;
    private String lockStatus;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
