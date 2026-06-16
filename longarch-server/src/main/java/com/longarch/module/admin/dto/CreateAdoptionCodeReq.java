package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CreateAdoptionCodeReq {

    @NotNull(message = "订单ID不能为空")
    private Long orderId;

    private String codeType;

    @NotNull(message = "有效开始时间不能为空")
    private String validFrom;

    @NotNull(message = "有效结束时间不能为空")
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
