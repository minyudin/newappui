package com.longarch.module.plot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("farming_record")
public class FarmingRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long plotId;
    private Long cropBatchId;
    private String recordType;
    private String recordTitle;
    private String operatorName;
    private LocalDateTime recordTime;
    private String description;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
