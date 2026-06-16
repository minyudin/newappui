package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class CodeListVO {
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
    private Integer canViewLive;
    private Integer canOperate;
    private Integer shareable;
    private String createdAt;
}
