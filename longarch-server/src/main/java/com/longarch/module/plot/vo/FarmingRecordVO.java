package com.longarch.module.plot.vo;

import lombok.Data;

@Data
public class FarmingRecordVO {

    private Long recordId;
    private String recordType;
    private String recordTitle;
    private String operatorName;
    private String recordTime;
    private String description;
}
