package com.longarch.module.adoption.vo;

import lombok.Data;

@Data
public class AdoptionDetailVO {

    private Long orderId;
    private String orderNo;
    private Long plotId;
    private String plotName;
    private Long cropBatchId;
    private String cropName;
    private String varietyName;
    private String adoptionType;
    private String startAt;
    private String endAt;
    private String orderStatus;
    private String visibilityLevel;
    private String operationLevel;
}
