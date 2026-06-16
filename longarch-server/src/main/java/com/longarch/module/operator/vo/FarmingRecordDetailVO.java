package com.longarch.module.operator.vo;

import lombok.Data;

@Data
public class FarmingRecordDetailVO {

    private Long recordId;
    private Long plotId;
    private Long cropBatchId;
    private String recordType;
    private String recordTitle;
    private String operatorName;
    private String recordTime;
    private String description;
    private String createdAt;
}
