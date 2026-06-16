package com.longarch.module.screen.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("screen_device")
public class ScreenDevice {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String deviceNo;
    private String screenName;
    private Long plotId;
    private String screenToken;
    private String layoutConfig;
    private String status;
    private LocalDateTime lastPingAt;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
