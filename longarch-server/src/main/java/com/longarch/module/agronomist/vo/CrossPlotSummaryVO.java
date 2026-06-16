package com.longarch.module.agronomist.vo;

import lombok.Data;

import java.util.List;

@Data
public class CrossPlotSummaryVO {

    private Long farmId;
    private String farmName;
    private int totalPlots;
    private int riskPlots;
    private List<PlotSummary> plots;

    @Data
    public static class PlotSummary {
        private Long plotId;
        private String plotName;
        private String cropName;
        private String growthStage;
        private String riskHint;
        private String batchStatus;
    }
}
