package com.longarch.module.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatePlotReq {

    private String plotNo;

    @NotBlank(message = "地块名称不能为空")
    private String plotName;

    /** 所属大棚 ID（null 表示自身是大棚级别） */
    private Long parentId;

    private Long farmId;

    private String farmName;

    private BigDecimal areaSize;

    private String areaUnit;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String introText;
}
