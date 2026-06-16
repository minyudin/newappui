package com.longarch.module.task.vo;

import lombok.Data;

@Data
public class QueueStatusVO {

    private Long taskId;
    private String taskStatus;
    private Integer queueNo;
    private Integer estimatedWaitMinutes;
    private Boolean deviceBusy;
    private Long currentRunningTaskId;
}
