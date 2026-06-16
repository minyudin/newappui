package com.longarch.module.plot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("crop_batch")
public class CropBatch {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String batchNo;
    private Long plotId;
    private String cropName;
    private String varietyName;
    private String growthStage;
    private String batchStatus;
    private LocalDateTime sowingAt;
    private LocalDateTime expectedHarvestAt;
    private String nextTask;
    private String riskHint;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
