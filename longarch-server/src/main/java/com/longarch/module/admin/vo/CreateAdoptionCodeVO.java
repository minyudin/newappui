package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;

@Data
public class CreateAdoptionCodeVO {

    private Long adoptionCodeId;
    private String code;
    private String codeType;
    private Long orderId;
    private String status;
    private String validFrom;
    private String validTo;
    private Permissions permissions;
    private String createdAt;

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
