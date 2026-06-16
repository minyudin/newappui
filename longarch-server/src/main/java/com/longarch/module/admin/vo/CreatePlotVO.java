package com.longarch.module.admin.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatePlotVO {

    private Long plotId;
    private String plotNo;
    private String plotName;
    private Long farmId;
    private String farmName;
    private BigDecimal areaSize;
    private String areaUnit;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String plotStatus;
    private String introText;
    private String createdAt;
}
