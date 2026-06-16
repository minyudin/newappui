package com.longarch.module.edge.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("edge_node")
public class EdgeNode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String nodeNo;
    private Long farmId;
    private String nodeName;
    private String hardwareType;
    private String osVersion;
    private String runtimeVersion;
    private String networkStatus;
    private String healthStatus;
    private Long localStorageFreeMb;
    private LocalDateTime lastHeartbeatAt;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
