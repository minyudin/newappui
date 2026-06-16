package com.longarch.module.admin.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 更新地块请求 · 全字段可选 (null 表示不改)
 * ============================================================
 *  约束:
 *    · plotNo 不允许改 (唯一索引 + 对外印制的认养卡上有这个号)
 *    · parentId / farmId 不允许改 (涉及层级重挂, 会冲击已绑定的设备/订单)
 *    · plotStatus 走该字段, 例如从 active 切 fallow 休耕
 * ============================================================ */
@Data
public class UpdatePlotReq {

    private String plotName;

    private BigDecimal areaSize;

    private String areaUnit;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String plotStatus;

    private String liveCoverUrl;

    private String introText;
}
