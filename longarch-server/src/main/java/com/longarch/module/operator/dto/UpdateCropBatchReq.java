package com.longarch.module.operator.dto;

import lombok.Data;

@Data
public class UpdateCropBatchReq {

    private String growthStage;

    private String batchStatus;

    private String nextTask;

    private String riskHint;

    private String expectedHarvestAt;
}
