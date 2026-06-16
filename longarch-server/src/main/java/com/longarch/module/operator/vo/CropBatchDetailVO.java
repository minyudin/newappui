package com.longarch.module.operator.vo;

import lombok.Data;

@Data
public class CropBatchDetailVO {

    private Long cropBatchId;
    private String batchNo;
    private Long plotId;
    private String cropName;
    private String varietyName;
    private String growthStage;
    private String batchStatus;
    private String sowingAt;
    private String expectedHarvestAt;
    private String nextTask;
    private String riskHint;
    private String updatedAt;
}
