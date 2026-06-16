package com.longarch.module.adoption.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateShareCodeReq {

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    private Integer canViewLive;
    private Integer canViewHistory;
    private Integer historyDays;
    private Integer canViewSensor;
    private Integer canOperate;
    private String operationWhitelist;
    private Integer maxDailyOperations;

    /** 有效天数，默认7天 */
    private Integer validDays;

    private String dailyAccessStart;
    private String dailyAccessEnd;
}
