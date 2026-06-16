package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class CreateCropBatchVO {
    private Long cropBatchId;
    private String batchNo;
    private Long plotId;
    private String cropName;
    private String varietyName;
    private String growthStage;
    private String batchStatus;
    private String sowingAt;
    private String expectedHarvestAt;
    private String createdAt;
}
