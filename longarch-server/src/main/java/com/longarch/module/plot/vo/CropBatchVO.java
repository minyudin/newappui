package com.longarch.module.plot.vo;

import lombok.Data;

@Data
public class CropBatchVO {

    private Long cropBatchId;
    private String batchNo;
    private String cropName;
    private String varietyName;
    private String growthStage;
    private String batchStatus;
    private String sowingAt;
    private String expectedHarvestAt;
    private AgronomyPlan agronomyPlan;

    @Data
    public static class AgronomyPlan {
        private String nextTask;
        private String riskHint;
    }
}
