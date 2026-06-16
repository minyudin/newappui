package com.longarch.module.task.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("operator_plot_binding")
public class OperatorPlotBinding {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long operatorUserId;
    private Long plotId;
    private Integer isPrimary;
    private String status;
    private LocalDateTime validFrom;
    private LocalDateTime validTo;
    private Long createdBy;
    private Long updatedBy;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}

