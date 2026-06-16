package com.longarch.module.task.vo;

import lombok.Data;

@Data
public class TaskListVO {

    private Long taskId;
    private String taskNo;
    private Long plotId;
    private String plotName;
    private String actionType;
    private String actionName;
    private String taskStatus;
    private String deviceExecutionState;
    private Integer queueNo;
    private String createdAt;

    // operator review flow (用于 operator 队列/筛选)
    private String reviewState;
    private String riskLevel;
    private Long assigneeUserId;
}
