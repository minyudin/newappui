package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class TaskListVO {
    private Long taskId;
    private String taskNo;
    private Long requestUserId;
    /** 解析后的申请人昵称 (若无则 "—") */
    private String requesterName;
    private Long plotId;
    /** 解析后的地块名 (若无则 "—") */
    private String plotName;
    private Long deviceId;
    /** 解析后的设备编号 (如 SEN-ENV-DM01) */
    private String deviceNo;
    /** 解析后的设备名称 (如 水肥一体机-1) */
    private String deviceName;
    private String actionType;
    private Integer priority;
    private String taskStatus;
    private String deviceExecutionState;
    private String failReason;
    private String createdAt;
    private String finishedAt;
}
