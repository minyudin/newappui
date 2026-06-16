package com.longarch.module.ai.vo;

import lombok.Data;

import java.util.Map;

@Data
public class AiChatVO {

    private String sessionId;
    private String intent;
    private Long targetPlotId;
    private Long targetDeviceId;
    private String action;
    private Map<String, Object> params;
    private Boolean needConfirm;
    private Boolean permissionCheck;
    private String schedulingMode;
    private String riskLevel;
    private String reply;
    private String suggestion;
}
