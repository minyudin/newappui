package com.longarch.module.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class AiCreateTaskReq {

    @NotBlank(message = "会话ID不能为空")
    private String sessionId;

    @NotNull(message = "地块ID不能为空")
    private Long plotId;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotBlank(message = "操作类型不能为空")
    private String actionType;

    private Map<String, Object> actionParams;
}
