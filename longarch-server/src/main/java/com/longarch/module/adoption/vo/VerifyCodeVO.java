package com.longarch.module.adoption.vo;

import lombok.Data;

import java.util.List;

@Data
public class VerifyCodeVO {

    private Boolean valid;
    private String codeType;
    private String status;
    private Long orderId;
    private Long plotId;
    private Long cropBatchId;
    private String validFrom;
    private String validTo;
    private String dailyAccessStart;
    private String dailyAccessEnd;
    private Permissions permissions;

    @Data
    public static class Permissions {
        private Boolean canViewLive;
        private Boolean canViewHistory;
        private Integer historyDays;
        private Boolean canViewSensor;
        private Boolean canOperate;
        private List<String> operationWhitelist;
        private Integer maxDailyOperations;
        private Boolean shareable;
    }
}
