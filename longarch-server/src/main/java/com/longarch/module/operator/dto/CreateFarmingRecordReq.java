package com.longarch.module.operator.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateFarmingRecordReq {

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    private Long cropBatchId;

    @NotBlank(message = "记录类型不能为空")
    private String recordType;

    @NotBlank(message = "记录标题不能为空")
    private String recordTitle;

    private String recordTime;

    private String description;
}
