package com.longarch.module.ai.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class AiAnalysisVO {

    private Long id;
    private Long plotId;
    private String analysisType;
    private List<Map<String, Object>> sensorSnapshot;
    private String cropInfo;
    private String analysisResult;
    private String riskLevel;
    private List<String> suggestedActions;
    private String createdAt;
}
