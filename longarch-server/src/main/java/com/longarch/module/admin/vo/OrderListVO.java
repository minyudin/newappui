package com.longarch.module.admin.vo;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class OrderListVO {
    private Long orderId;
    private String orderNo;
    private Long userId;
    private Long plotId;
    private Long cropBatchId;
    private String adoptionType;
    private String orderStatus;
    private String payStatus;
    private BigDecimal payableAmount;
    private String visibilityLevel;
    private String operationLevel;
    private String remark;
    private Long createdBy;
    private String startAt;
    private String endAt;
    private String createdAt;
}
