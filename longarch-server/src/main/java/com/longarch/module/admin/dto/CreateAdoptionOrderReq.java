package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateAdoptionOrderReq {

    private Long userId;

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    private Long cropBatchId;

    private String adoptionType;

    @NotNull(message = "开始时间不能为空")
    private String startAt;

    @NotNull(message = "结束时间不能为空")
    private String endAt;

    private String visibilityLevel;

    private String operationLevel;

    private BigDecimal payableAmount;

    private String remark;
}
