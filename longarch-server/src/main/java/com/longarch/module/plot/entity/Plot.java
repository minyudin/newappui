package com.longarch.module.plot.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("plot")
public class Plot {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String plotNo;
    private String plotName;
    private Long farmId;
    private String farmName;
    private Long parentId;
    private BigDecimal areaSize;
    private String areaUnit;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String plotStatus;
    private String liveCoverUrl;
    private String introText;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
