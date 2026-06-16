package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("operation_task_queue")
public class OperationTaskQueue {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;
    private Long deviceId;
    private Long plotId;
    private Integer priority;
    private LocalDateTime queuedAt;
    private LocalDateTime expireAt;
    private String taskStatus;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
