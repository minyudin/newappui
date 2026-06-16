package com.longarch.module.agronomist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewAiAnalysisReq {

    @NotNull(message = "分析记录ID不能为空")
    private Long analysisId;

    @NotBlank(message = "审核结论不能为空")
    private String reviewResult;

    private String reviewComment;
}
