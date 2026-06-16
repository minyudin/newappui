package com.longarch.module.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AiGeneralChatReq {

    @NotBlank(message = "会话ID不能为空")
    private String sessionId;

    @NotBlank(message = "消息内容不能为空")
    private String message;
}

