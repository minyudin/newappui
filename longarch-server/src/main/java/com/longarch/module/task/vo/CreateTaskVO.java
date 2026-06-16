package com.longarch.module.task.vo;

import lombok.Data;

@Data
public class CreateTaskVO {

    private Long taskId;
    private String taskNo;
    private String taskStatus;
    private Integer queueNo;
    private Integer estimatedWaitMinutes;
    private String deviceExecutionState;
    private String message;

    // operator review flow
    private String reviewState;
    private String riskLevel;
    private String riskReasons;
}
