package com.longarch.module.agronomist.vo;

import lombok.Data;

@Data
public class RiskAlertVO {

    private Long plotId;
    private String plotName;
    private Long cropBatchId;
    private String cropName;
    private String growthStage;
    private String riskHint;
    private String batchStatus;
    private String updatedAt;
}
