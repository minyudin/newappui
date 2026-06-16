package com.longarch.module.admin.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 地块详情 VO · 比 PlotListVO 多出经纬度 / 封面 / 简介等字段
 * ============================================================
 *  - 供 GET /admin/plots/{id} 使用
 *  - updatedAt 方便前端判断是否有过编辑
 * ============================================================ */
@Data
public class PlotDetailVO {

    private Long plotId;
    private String plotNo;
    private String plotName;
    private Long parentId;
    private String parentName;
    private Long farmId;
    private String farmName;
    private BigDecimal areaSize;
    private String areaUnit;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private String plotStatus;
    private String liveCoverUrl;
    private String introText;
    private String createdAt;
    private String updatedAt;
}
