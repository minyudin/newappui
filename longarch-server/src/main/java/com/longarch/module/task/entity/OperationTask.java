package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("operation_task")
public class OperationTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String taskNo;
    private Long requestUserId;
    private Long plotId;
    private Long deviceId;
    private String actionType;
    private String actionParams;
    private String schedulingMode;
    private LocalDateTime expectedExecuteAt;
    private String idempotencyKey;
    private Integer priority;
    private String taskStatus;
    private String deviceExecutionState;
    private Integer queueNo;
    private Integer estimatedWaitMinutes;
    private String failReason;
    private Integer cancelable;
    private LocalDateTime queuedAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    /**
     * 两阶段回执截止时间(V10 引入)
     *   · ackDeadlineAt    : 设备需在此之前发 accepted 回执, 否则判"设备未确认接收"失败
     *   · resultDeadlineAt : 设备需在此之前发 success/failed 回执, 否则判"执行超时"失败
     * dispatch 时同时写入, 收到 accepted 后清 ackDeadlineAt, 终态时两列都清空.
     */
    private LocalDateTime ackDeadlineAt;
    private LocalDateTime resultDeadlineAt;

    /**
     * operator review flow:
     *   none -> operator_required -> (approved|rejected)
     */
    private String reviewState;
    private String riskLevel;
    private String riskReasons;

    private Long assigneeUserId;
    private String assignmentMode;
    private LocalDateTime assignedAt;
    private Long assignedBy;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
