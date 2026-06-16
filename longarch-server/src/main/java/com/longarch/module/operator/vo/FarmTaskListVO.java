package com.longarch.module.operator.vo;

import lombok.Data;

@Data
public class FarmTaskListVO {

    private Long taskId;
    private String taskNo;
    private Long plotId;
    private String plotName;
    private Long userId;
    private String actionType;
    private String taskStatus;
    private Integer priority;
    private String createdAt;
    private String executedAt;
}
