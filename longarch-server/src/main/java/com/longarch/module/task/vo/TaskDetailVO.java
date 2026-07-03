package com.longarch.module.task.vo;

import lombok.Data;

import java.util.Map;

@Data
public class TaskDetailVO {

    private Long taskId;
    private String taskNo;
    private Long requestUserId;
    private Long plotId;
    private String plotName;
    private Long deviceId;
    private String deviceName;
    private String actionType;
    private String actionName;
    private Map<String, Object> actionParams;
    private String schedulingMode;
    private Integer priority;
    private String taskStatus;
    private String deviceExecutionState;
    private Integer queueNo;
    private Integer estimatedWaitMinutes;
    private String failReason;
    private String createdAt;
    private String queuedAt;
    private String startedAt;
    private String finishedAt;
    // 两阶段回执截止时间(V12)· 前端据此显示"设备确认倒计时 / 预计完成倒计时"
    private String ackDeadlineAt;
    private String resultDeadlineAt;
    private Boolean cancelable;

    // operator review flow
    private String reviewState;
    private String riskLevel;
    private String riskReasons;
    private Long assigneeUserId;
}
