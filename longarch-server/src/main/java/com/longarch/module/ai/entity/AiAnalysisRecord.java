package com.longarch.module.ai.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("ai_analysis_record")
public class AiAnalysisRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long plotId;
    private String analysisType;
    private String sensorSnapshot;
    private String cropInfo;
    private String analysisResult;
    private String riskLevel;
    private String suggestedActions;
    private String reviewResult;
    private String reviewComment;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
