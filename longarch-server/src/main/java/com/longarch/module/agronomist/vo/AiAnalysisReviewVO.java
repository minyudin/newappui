package com.longarch.module.agronomist.vo;

import lombok.Data;

@Data
public class AiAnalysisReviewVO {

    private Long analysisId;
    private Long plotId;
    private String analysisType;
    private String reviewResult;
    private String reviewComment;
    private Long reviewedBy;
    private String reviewedAt;
}
