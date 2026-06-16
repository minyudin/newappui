package com.longarch.module.adoption.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@TableName("adoption_code")
public class AdoptionCode {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String code;
    private String codeType;
    private Long orderId;
    private Long plotId;
    private Long cropBatchId;
    private Long bindUserId;
    private String status;
    private LocalDateTime validFrom;
    private LocalDateTime validTo;
    private LocalTime dailyAccessStart;
    private LocalTime dailyAccessEnd;
    private Integer canViewLive;
    private Integer canViewHistory;
    private Integer historyDays;
    private Integer canViewSensor;
    private Integer canOperate;
    private String operationWhitelist;
    private Integer maxDailyOperations;
    private Integer shareable;
    private Long createdByUserId;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
