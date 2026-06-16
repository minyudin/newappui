package com.longarch.module.admin.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateAdoptionOrderVO {

    private Long orderId;
    private String orderNo;
    private Long userId;
    private Long plotId;
    private Long cropBatchId;
    private String adoptionType;
    private String startAt;
    private String endAt;
    private String orderStatus;
    private String payStatus;
    private String visibilityLevel;
    private String operationLevel;
    private Long createdBy;
    private String createdAt;
}
