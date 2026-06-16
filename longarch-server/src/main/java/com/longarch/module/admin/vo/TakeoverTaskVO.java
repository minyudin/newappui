package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class TakeoverTaskVO {

    private Long taskId;
    private String taskNo;
    private Boolean takeoverSuccess;
    private String taskStatus;
    private Integer priority;
    private Long takenOverBy;
    private String takenOverAt;
    private String message;
}
