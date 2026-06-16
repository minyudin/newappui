package com.longarch.module.adoption.vo;

import lombok.Data;

@Data
public class ShareCodeVO {

    private Long codeId;
    private String code;
    private String codeType;
    private Long plotId;
    private Long orderId;
    private Long createdByUserId;
    private Long bindUserId;
    private String status;
    private String validFrom;
    private String validTo;
    private String dailyAccessStart;
    private String dailyAccessEnd;

    private Integer canViewLive;
    private Integer canViewHistory;
    private Integer historyDays;
    private Integer canViewSensor;
    private Integer canOperate;
    private String operationWhitelist;
    private Integer maxDailyOperations;

    private String createdAt;
}
