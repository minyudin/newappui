package com.longarch.module.admin.vo;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PlotListVO {
    private Long plotId;
    private String plotNo;
    private String plotName;
    private Long parentId;
    private String parentName;
    private Long farmId;
    private String farmName;
    private BigDecimal areaSize;
    private String areaUnit;
    private String plotStatus;
    private String createdAt;
}
