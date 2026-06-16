package com.longarch.module.adoption.vo;

import lombok.Data;

import java.util.List;

@Data
public class AccessScopeVO {

    private Long plotId;
    private Long orderId;
    private Visibility visibility;
    private Operation operation;
    private TimeWindow timeWindow;

    @Data
    public static class Visibility {
        private Boolean canViewPlotInfo;
        private Boolean canViewLiveVideo;
        private Boolean canViewHistoryVideo;
        private Integer historyDays;
        private Boolean canViewSensorData;
        private Boolean canViewOperationLog;
        private Boolean canViewAiAnalysis;
    }

    @Data
    public static class Operation {
        private Boolean canOperate;
        private List<String> operationWhitelist;
        private Integer maxDailyOperations;
        private Boolean canReserveTask;
        private Boolean canCancelPendingTask;
    }

    @Data
    public static class TimeWindow {
        private String validFrom;
        private String validTo;
        private String dailyAccessStart;
        private String dailyAccessEnd;
    }
}
