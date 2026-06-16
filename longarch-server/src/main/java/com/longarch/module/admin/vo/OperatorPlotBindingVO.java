package com.longarch.module.admin.vo;

import lombok.Data;

@Data
public class OperatorPlotBindingVO {
    private Long bindingId;
    private Long operatorUserId;
    private Long plotId;
    private Integer isPrimary;
    private String status;
}

