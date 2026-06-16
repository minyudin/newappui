package com.longarch.module.task.vo;

import lombok.Data;

@Data
public class CancelTaskVO {

    private Long taskId;
    private String taskStatus;
}
