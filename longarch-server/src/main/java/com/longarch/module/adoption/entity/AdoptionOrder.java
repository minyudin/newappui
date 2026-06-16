package com.longarch.module.adoption.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("adoption_order")
public class AdoptionOrder {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String orderNo;
    private Long userId;
    private Long plotId;
    private Long cropBatchId;
    private String adoptionType;
    private String orderStatus;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String visibilityLevel;
    private String operationLevel;
    private BigDecimal payableAmount;
    private String payStatus;
    private String remark;
    private Long createdBy;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
