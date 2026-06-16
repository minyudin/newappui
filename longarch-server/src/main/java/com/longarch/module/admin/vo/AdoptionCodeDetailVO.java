package com.longarch.module.admin.vo;

import lombok.Data;

import java.util.List;

/**
 * 认养码详情 VO · 比 CodeListVO 多出完整权限矩阵 + 每日时间窗
 * ============================================================
 *  - 供 GET /admin/adoption-codes/{id} 使用
 *  - operationWhitelist 从数据库 JSON 字符串反序列化为 List<String>
 *    前端可直接 render 不用再解一次
 * ============================================================ */
@Data
public class AdoptionCodeDetailVO {

    private Long codeId;
    private String code;
    private String codeType;
    private Long orderId;
    private Long plotId;
    private Long cropBatchId;
    private Long bindUserId;
    private String status;

    private String validFrom;
    private String validTo;
    private String dailyAccessStart;
    private String dailyAccessEnd;

    // 完整权限矩阵
    private Integer canViewLive;
    private Integer canViewHistory;
    private Integer historyDays;
    private Integer canViewSensor;
    private Integer canOperate;
    private Integer shareable;
    private Integer maxDailyOperations;
    private List<String> operationWhitelist;

    private Long createdByUserId;
    private String createdAt;
    private String updatedAt;
}
